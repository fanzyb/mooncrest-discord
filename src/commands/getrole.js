import { SlashCommandBuilder, EmbedBuilder, PermissionsBitField } from "discord.js";
import { findUserByDiscordId } from "../db/firestore.js";
import { getRobloxRankName, embedColor } from "../utils/helpers.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("getrole")
    .setDescription("Sync a user's Roblox group rank to their Discord roles.")
    .addUserOption(opt =>
        opt.setName("target")
            .setDescription("The user to sync. Defaults to yourself if not provided.")
            .setRequired(false)
    );

export async function execute(interaction) {
    try {
        // [PERUBAHAN] Mengubah ephemeral menjadi false agar terlihat oleh semua orang
        await interaction.deferReply({ ephemeral: false });

        const targetUser = interaction.options.getUser("target");
        const isSelf = !targetUser;

        if (!isSelf && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            // Pesan error untuk admin tetap ephemeral agar tidak mengganggu chat
            return interaction.editReply({ content: "❌ You must be an administrator to sync roles for other users.", ephemeral: true });
        }

        const memberToSync = targetUser ? await interaction.guild.members.fetch(targetUser.id) : interaction.member;
        const userIdToSync = memberToSync.id;

        const userFromDb = await findUserByDiscordId(userIdToSync);
        if (!userFromDb || !userFromDb.robloxId) {
            const who = isSelf ? "You are" : `<@${userIdToSync}> is`;
            return interaction.editReply({ content: `❌ ${who} not verified yet. They need to use \`/verify\` first.` });
        }

        const robloxRankName = await getRobloxRankName(userFromDb.robloxId);
        if (!robloxRankName || robloxRankName === "Guest") {
            const who = isSelf ? "your rank, or you are" : `the rank for <@${userIdToSync}>, or they are`;
            return interaction.editReply({ content: `❌ Could not retrieve ${who} not in the Roblox group.` });
        }

        const rankMapping = config.rankToRoleMapping || {};
        const targetRoleId = rankMapping[robloxRankName];

        if (!targetRoleId) {
            const who = isSelf ? "Your" : "Their";
            return interaction.editReply({ content: `ℹ️ ${who} Roblox rank is **${robloxRankName}**, but there is no corresponding Discord role configured for it.` });
        }

        const targetRole = interaction.guild.roles.cache.get(targetRoleId);
        if (!targetRole) {
            console.error(`[ERROR] Role with ID '${targetRoleId}' for rank '${robloxRankName}' not found in this server.`);
            return interaction.editReply({ content: "❌ An error occurred. A configured role could not be found. Please contact an admin." });
        }

        if (memberToSync.roles.cache.has(targetRoleId)) {
            const who = isSelf ? "You already have" : `<@${userIdToSync}> already has`;
            return interaction.editReply({ content: `✅ ${who} the **${targetRole.name}** role, which matches their Roblox rank!` });
        }

        const allRankRoleIds = Object.values(rankMapping);
        const rolesToRemove = memberToSync.roles.cache.filter(role => allRankRoleIds.includes(role.id));
        if (rolesToRemove.size > 0) {
            await memberToSync.roles.remove(rolesToRemove);
            console.log(`[GETROLE] Removed old rank roles from ${memberToSync.user.tag}.`);
        }

        await memberToSync.roles.add(targetRole);

        const description = isSelf
            ? `You have been successfully given the **${targetRole.name}** role to match your rank in the Roblox group!`
            : `Successfully synced roles for <@${userIdToSync}>. They have been given the **${targetRole.name}** role.`;

        const embed = new EmbedBuilder()
            .setTitle("✅ Role Synchronized!")
            .setColor(embedColor)
            .setDescription(description)
            .addFields(
                { name: "Roblox Rank", value: robloxRankName, inline: true },
                { name: "Discord Role", value: `<@&${targetRole.id}>`, inline: true }
            )
            .setTimestamp();

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logError(error, interaction, "getrole");
        const errorMessage = "❌ An unexpected error occurred while processing the command.";
        if (error.message.includes("Missing Permissions")) {
            await interaction.editReply({ content: "❌ Failed to assign role. The bot does not have permission to manage roles. Please contact an admin." });
        } else if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: errorMessage });
        } else {
            await interaction.reply({ content: errorMessage, ephemeral: true });
        }
    }
}