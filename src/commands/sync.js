import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getAllUsers } from "../db/firestore.js";
import { getLevel } from "../utils/helpers.js";
import { logError } from "../utils/errorLogger.js";
import config from "../config.json" with { type: "json" };

export const data = new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Bulk sync all linked users' roles based on their current XP level.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    const commandName = "sync";
    try {
        // Hanya admin
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ You must be an administrator to use this command.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const rankMapping = config.rankToRoleMapping || {};
        const allRankRoleIds = Object.values(rankMapping);

        if (allRankRoleIds.length === 0) {
            return interaction.editReply({ content: "⚠️ No `rankToRoleMapping` configured in `config.json`. Cannot sync roles." });
        }

        const allUsers = await getAllUsers();
        const linkedUsers = allUsers.filter(u => u.discordId && u.isVerified);

        if (linkedUsers.length === 0) {
            return interaction.editReply({ content: "ℹ️ No linked users found in the database to sync." });
        }

        let successCount = 0;
        let failCount = 0;
        let unchangedCount = 0;

        await interaction.editReply({ content: `Syncing roles for ${linkedUsers.length} linked users... (This may take a while)` });

        for (const user of linkedUsers) {
            try {
                // 1. Tentukan role yang seharusnya dimiliki
                const level = getLevel(user.xp);
                const targetLevelName = level.levelName;
                const targetRoleId = rankMapping[targetLevelName];

                // 2. Ambil member Discord
                const member = await interaction.guild.members.fetch(user.discordId).catch(() => null);

                if (!member) {
                    failCount++; // User mungkin sudah keluar dari server
                    continue;
                }

                // 3. Tentukan role yang akan dihapus dan ditambah
                const rolesToRemove = member.roles.cache.filter(role => 
                    allRankRoleIds.includes(role.id) && role.id !== targetRoleId
                );
                
                const hasTargetRole = targetRoleId ? member.roles.cache.has(targetRoleId) : true; // Jika tidak ada target role (misal level tinggi), anggap "punya"

                if (rolesToRemove.size === 0 && hasTargetRole) {
                    unchangedCount++;
                    continue; // Role sudah benar
                }

                // 4. Lakukan perubahan role
                if (rolesToRemove.size > 0) {
                    await member.roles.remove(rolesToRemove);
                }
                if (targetRoleId && !hasTargetRole) {
                    await member.roles.add(targetRoleId);
                }
                
                successCount++;

            } catch (err) {
                console.error(`[SYNC] Failed to sync roles for user ${user.robloxUsername} (Discord: ${user.discordId}): ${err.message}`);
                failCount++;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle("✅ Bulk Role Sync Complete")
            .setColor(config.embedColor || "#00FF00")
            .addFields(
                { name: "Successfully Updated", value: `**${successCount}** users`, inline: true },
                { name: "Already Correct", value: `**${unchangedCount}** users`, inline: true },
                { name: "Failed / Not Found", value: `**${failCount}** users`, inline: true },
                { name: "Total Linked Users", value: `**${linkedUsers.length}** users`, inline: false }
            )
            .setTimestamp();
        
        await interaction.editReply({ content: "Sync complete!", embeds: [embed] });

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred during the bulk sync." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}