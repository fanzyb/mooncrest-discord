import { EmbedBuilder } from "discord.js";
import { getGiveaway, getGiveawayParticipants, updateGiveaway, addGiveawayParticipant, getAllRunningGiveaways } from "../db/firestore.js";
import { logError } from "./errorLogger.js";


/**
 * Handles the "Join" button click for giveaways
 * @param {import('discord.js').ButtonInteraction} interaction
 */
export async function handleGiveawayButton(interaction) {
    const commandName = "giveaway:button";
    try {
        await interaction.deferReply({ ephemeral: true });

        const messageId = interaction.message.id;
        const userId = interaction.user.id;

        const giveaway = await getGiveaway(messageId);
        if (!giveaway || giveaway.ended) {
            return interaction.editReply({ content: "❌ This giveaway has already ended." });
        }

        // Check for required role
        if (giveaway.requiredRoleId) {
            if (!interaction.member.roles.cache.has(giveaway.requiredRoleId)) {
                return interaction.editReply({ content: `❌ **Entry Failed:** You need the <@&${giveaway.requiredRoleId}> role to join this giveaway.` });
            }
        }

        // Check if user already entered
        const participants = await getGiveawayParticipants(messageId);
        if (participants.includes(userId)) {
            return interaction.editReply({ content: "ℹ️ You have already entered this giveaway." });
        }

        // Add user
        await addGiveawayParticipant(messageId, userId);

        // Update participant count on embed
        try {
            const newCount = participants.length + 1;
            const embed = EmbedBuilder.from(interaction.message.embeds[0]);
            embed.setDescription(
                embed.data.description.replace(/(\*\*Participants:\*\* )\d+/, `$1${newCount}`)
            );
            await interaction.message.edit({ embeds: [embed] });
        } catch (e) {
            // Non-fatal error, just log it.
            console.warn(`[Giveaway] Failed to update participant count on embed: ${e.message}`);
        }

        return interaction.editReply({ content: "✅ **You have joined the giveaway!**" });

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while entering." });
        }
    }
}

/**
 * Periodically checks Firestore for giveaways that need to end.
 * @param {import('discord.js').Client} client
 */
export async function checkGiveaways(client) {
    const giveawaysToEnd = await getAllRunningGiveaways();
    if (giveawaysToEnd.length === 0) return;

    console.log(`[Giveaway] Found ${giveawaysToEnd.length} giveaway(s) to end.`);

    for (const giveaway of giveawaysToEnd) {
        await endGiveaway(client, giveaway);
    }
}

/**
 * Picks winners from a list of participant IDs.
 * @param {string[]} participantIds - Array of user IDs.
 * @param {number} winnerCount - Number of winners to pick.
 * @returns {string[]} - Array of winner user IDs.
 */
export function pickWinners(participantIds, winnerCount) {
    const winners = [];
    const participants = [...participantIds]; // Create a copy

    for (let i = 0; i < winnerCount; i++) {
        if (participants.length === 0) break; // Stop if we run out of participants
        const winnerIndex = Math.floor(Math.random() * participants.length);
        winners.push(participants.splice(winnerIndex, 1)[0]);
    }
    return winners;
}

/**
 * Ends a giveaway, picks winners, and announces them.
 * @param {import('discord.js').Client} client
 * @param {object} giveaway - The giveaway data from Firestore.
 */
export async function endGiveaway(client, giveaway) {
    try {
        const guild = await client.guilds.fetch(giveaway.guildId).catch(() => null);
        if (!guild) return false;

        const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null);
        if (!channel) return false;

        const message = await channel.messages.fetch(giveaway.messageId).catch(() => null);
        if (!message) {
            // Message was deleted, mark as ended and return
            await updateGiveaway(giveaway.messageId, { ended: true });
            return false;
        }

        let participants = await getGiveawayParticipants(giveaway.messageId);

        // Final role check
        if (giveaway.requiredRoleId && participants.length > 0) {
            const role = await guild.roles.fetch(giveaway.requiredRoleId).catch(() => null);
            if (role) {
                const validParticipants = [];
                for (const userId of participants) {
                    const member = await guild.members.fetch(userId).catch(() => null);
                    if (member && member.roles.cache.has(giveaway.requiredRoleId)) {
                        validParticipants.push(userId);
                    }
                }
                participants = validParticipants;
            }
        }

        const winners = pickWinners(participants, giveaway.winnerCount);

        // Announce winners
        if (winners.length > 0) {
            const winnerMentions = winners.map(id => `<@${id}>`).join(", ");
            await channel.send({ 
                content: `Congratulations ${winnerMentions}! You won the **${giveaway.prize}**!`,
                reply: { messageReference: giveaway.messageId }
            });
        } else {
            await channel.send({
                content: `Could not determine a winner for the **${giveaway.prize}**. (No valid participants).`,
                reply: { messageReference: giveaway.messageId }
            });
        }

        // Update original embed
        const endedEmbed = EmbedBuilder.from(message.embeds[0])
            .setTitle("🎉 GIVEAWAY ENDED 🎉")
            .setColor("#FF0000")
            .setDescription(
                `**Prize:** ${giveaway.prize}\n` +
                `**Winners:** ${winners.length > 0 ? winners.map(id => `<@${id}>`).join(", ") : "None"}`
            );

        await message.edit({ embeds: [endedEmbed], components: [] }); // Remove button

        // Mark as ended in DB
        await updateGiveaway(giveaway.messageId, { ended: true, winners: winners });
        return true;

    } catch (error) {
        console.error(`[Giveaway] CRITICAL: Failed to end giveaway ${giveaway.messageId}:`, error);
        // Mark as ended anyway to prevent loops
        await updateGiveaway(giveaway.messageId, { ended: true });
        return false;
    }
}