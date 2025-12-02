import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } from "discord.js";
import { parseDuration } from "../utils/parsing.js";
import { saveGiveaway, getGiveaway, getGiveawayParticipants, updateGiveaway } from "../db/firestore.js";
import { logError } from "../utils/errorLogger.js";
import { pickWinners, endGiveaway } from "../utils/giveawayHandler.js";
import config from "../config.json" with { type: "json" };

export const data = new SlashCommandBuilder()
    .setName("giveaway")
    .setDescription("Manage giveaways in the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("start")
            .setDescription("Start a new giveaway in this channel.")
            .addStringOption(opt => opt.setName("duration").setDescription("Duration (e.g., '1d', '6h', '30m')").setRequired(true))
            .addIntegerOption(opt => opt.setName("winners").setDescription("Number of winners (min 1).").setRequired(true).setMinValue(1))
            .addStringOption(opt => opt.setName("prize").setDescription("What is the prize?").setRequired(true))
            .addUserOption(opt => opt.setName("sponsor").setDescription("Optional: The user sponsoring this giveaway.").setRequired(false))
            .addRoleOption(opt => opt.setName("required_role").setDescription("Optional: Role required to enter.").setRequired(false))
    )
    .addSubcommand(sub =>
        sub.setName("reroll")
            .setDescription("Reroll for new winner(s) from a ended giveaway.")
            .addStringOption(opt => opt.setName("message_id").setDescription("The message ID of the ended giveaway.").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Number of new winners to pick (default 1).").setRequired(false).setMinValue(1))
    )
    .addSubcommand(sub =>
        sub.setName("end")
            .setDescription("End a running giveaway immediately and pick winner(s).")
            .addStringOption(opt => opt.setName("message_id").setDescription("The message ID of the running giveaway.").setRequired(true))
    );

export async function execute(interaction) {
    const commandName = `giveaway ${interaction.options.getSubcommand()}`;
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.giveawayManagerRoles || []).includes(r.id));
        if (!allowed) {
            return interaction.reply({ content: "❌ You must be an Administrator or a Giveaway Manager to use this command.", ephemeral: true });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === "start") {
            await interaction.deferReply({ ephemeral: true });

            const durationStr = interaction.options.getString("duration");
            const winnerCount = interaction.options.getInteger("winners");
            const prize = interaction.options.getString("prize");
            const sponsor = interaction.options.getUser("sponsor");
            const requiredRole = interaction.options.getRole("required_role");

            const durationMs = parseDuration(durationStr);
            if (!durationMs) {
                return interaction.editReply({ content: "❌ Invalid duration format. Use '1s', '10m', '1h', '1d' etc." });
            }

            const endTime = Date.now() + durationMs;

            const embed = new EmbedBuilder()
                .setTitle("🎉 GIVEAWAY 🎉")
                .setDescription(
                    `React with 🎉 to enter!\n` +
                    `**Prize:** ${prize}\n` +
                    `**Winners:** ${winnerCount}\n` +
                    `**Ends:** <t:${Math.floor(endTime / 1000)}:R>`
                )
                .setColor(config.embedColor || "#5865F2");

            if (sponsor) {
                embed.addFields({ name: "Sponsored by", value: `${sponsor}`, inline: true });
            }
            if (requiredRole) {
                embed.addFields({ name: "Requirement", value: `Must have the ${requiredRole} role.`, inline: true });
            }

            const joinButton = new ButtonBuilder()
                .setCustomId("giveaway_join")
                .setLabel("Join")
                .setStyle(ButtonStyle.Success)
                .setEmoji("🎉");

            const row = new ActionRowBuilder().addComponents(joinButton);

            const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

            const giveawayData = {
                messageId: msg.id,
                channelId: interaction.channel.id,
                guildId: interaction.guild.id,
                prize: prize,
                winnerCount: winnerCount,
                endTime: endTime,
                sponsorId: sponsor ? sponsor.id : null,
                requiredRoleId: requiredRole ? requiredRole.id : null,
                ended: false,
                winners: [], // Array of winner user IDs
            };

            await saveGiveaway(msg.id, giveawayData);
            await interaction.editReply({ content: "✅ Giveaway started successfully!" });
        }

        else if (sub === "reroll") {
            await interaction.deferReply({ ephemeral: true });

            const messageId = interaction.options.getString("message_id");
            const amount = interaction.options.getInteger("amount") || 1;

            const giveaway = await getGiveaway(messageId);

            if (!giveaway) {
                return interaction.editReply({ content: "❌ Could not find a giveaway with that message ID." });
            }
            if (!giveaway.ended) {
                return interaction.editReply({ content: "❌ This giveaway has not ended yet. Use `/giveaway end` first." });
            }

            const participants = await getGiveawayParticipants(messageId);
            if (!participants || participants.length === 0) {
                 return interaction.editReply({ content: "❌ No participants found for this giveaway." });
            }

            // Filter out existing winners from the participant list
            const potentialWinners = participants.filter(pId => !giveaway.winners.includes(pId));

            if (potentialWinners.length < amount) {
                return interaction.editReply({ content: `❌ Not enough new participants to draw ${amount} new winner(s). Only ${potentialWinners.length} available.` });
            }

            const newWinners = [];
            for (let i = 0; i < amount; i++) {
                const winnerId = potentialWinners.splice(Math.floor(Math.random() * potentialWinners.length), 1)[0];
                newWinners.push(winnerId);
            }

            // Save new winners to the DB
            const allWinners = giveaway.winners.concat(newWinners);
            await updateGiveaway(messageId, { winners: allWinners });

            const winnerMentions = newWinners.map(id => `<@${id}>`).join(", ");
            await interaction.channel.send({ content: `🎉 Congratulations to the new winner(s) for the **${giveaway.prize}**: ${winnerMentions}!` });
            await interaction.editReply({ content: `✅ Successfully re-rolled ${amount} winner(s).` });
        }

        else if (sub === "end") {
            await interaction.deferReply({ ephemeral: true });
            const messageId = interaction.options.getString("message_id");

            const giveaway = await getGiveaway(messageId);
            if (!giveaway) {
                return interaction.editReply({ content: "❌ Could not find a giveaway with that message ID." });
            }
            if (giveaway.ended) {
                return interaction.editReply({ content: "❌ This giveaway has already ended." });
            }

            // Manually trigger the end
            const endedSuccessfully = await endGiveaway(interaction.client, giveaway);

            if (endedSuccessfully) {
                await interaction.editReply({ content: "✅ Giveaway has been ended manually." });
            } else {
                await interaction.editReply({ content: "❌ Failed to end the giveaway. Check console logs." });
            }
        }

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred." });
        }
    }
}