import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from "discord.js";
import config from "../config.json" with { type: "json" };
import { findUserByDiscordId, findLeaderboardUsers } from "../db/firestore.js";
import { getLevel } from "../utils/helpers.js";
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("sync-rank")
    .setDescription("Sync Discord level to Roblox group rank")
    .addStringOption(opt =>
        opt.setName("target")
            .setDescription("Discord user or Roblox username to sync (leave empty to sync all)")
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    try {
        await interaction.deferReply();

        const target = interaction.options.getString("target");

        // Use global singleton Roblox instance
        const roblox = interaction.client.robloxHelper;

        // Check if Roblox helper is initialized
        if (!roblox || !roblox.getCurrentUser()) {
            return interaction.editReply({
                content: "❌ **Roblox bot not authenticated!**\n\nBot belum login ke Roblox atau cookie expired.\nSilakan restart bot atau hubungi admin untuk update cookie."
            });
        }

        const groupId = config.groupId;
        const levelMapping = config.robloxLevelMapping;

        let usersToSync = [];

        // Determine users to sync
        if (target) {
            // Sync single user
            const discordIdMatch = target.match(/<@!?(\d+)>|^\d{17,19}$/);
            let userDb;

            if (discordIdMatch) {
                const discordId = discordIdMatch[1] || target;
                userDb = await findUserByDiscordId(discordId);
            } else {
                // Search by Roblox username
                const results = await findLeaderboardUsers('robloxUsername', 1, 0);
                userDb = results.find(u => u.robloxUsername.toLowerCase() === target.toLowerCase());
            }

            if (!userDb) {
                return interaction.editReply({
                    content: `❌ User **${target}** not found in database.`
                });
            }

            usersToSync.push(userDb);
        } else {
            // Sync all verified users
            await interaction.editReply({ content: "🔄 Fetching all verified users..." });
            usersToSync = await findLeaderboardUsers('xp', 1000, 0); // Get top 1000 users
        }

        if (usersToSync.length === 0) {
            return interaction.editReply({ content: "⚠️ No users found to sync." });
        }

        // Start syncing
        const statusEmbed = new EmbedBuilder()
            .setTitle("🔄 Syncing Roblox Ranks...")
            .setDescription(`Syncing ${usersToSync.length} user(s)...`)
            .setColor(config.embedColor || "#1B1464")
            .setTimestamp();

        await interaction.editReply({ embeds: [statusEmbed] });

        let synced = 0;
        let skipped = 0;
        let errors = 0;
        const errorList = [];

        for (const user of usersToSync) {
            try {
                // Get user's level based on XP
                const { levelName } = getLevel(user.xp || 0);

                // Get corresponding Roblox role ID
                const targetRoleId = levelMapping[levelName];

                if (!targetRoleId) {
                    console.warn(`[Sync] No Roblox role mapping for level: ${levelName}`);
                    skipped++;
                    continue;
                }

                // Check if user is in group
                const currentRank = await roblox.getUserRankInGroup(user.robloxId, groupId);

                if (!currentRank) {
                    // User not in group
                    skipped++;
                    errorList.push(`${user.robloxUsername}: Not in group`);
                    continue;
                }

                // Check if user has special role (rank > 151) - skip syncing
                // Only sync level system ranks (Climber → Lunatic, rank 1-151)
                if (currentRank.rank > 151) {
                    skipped++;
                    errorList.push(`${user.robloxUsername}: Special role (${currentRank.roleName})`);
                    console.log(`[Sync] ⏭️ Skipped ${user.robloxUsername}: Has special role`);
                    continue;
                }

                // Check if rank already matches
                if (currentRank.roleId === targetRoleId) {
                    // Already correct rank
                    skipped++;
                    continue;
                }

                // Update rank
                await roblox.setUserRank(user.robloxId, groupId, targetRoleId);
                synced++;

                console.log(`[Sync] ✅ ${user.robloxUsername}: ${currentRank.roleName} → ${levelName}`);

                // Add small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));

            } catch (error) {
                errors++;
                console.error(`[Sync] Error syncing ${user.robloxUsername}:`, error.message);
                errorList.push(`${user.robloxUsername}: ${error.message}`);
            }
        }

        // Send result
        const resultEmbed = new EmbedBuilder()
            .setTitle("✅ Sync Complete")
            .setDescription(
                `**Results:**\n` +
                `✅ Synced: ${synced}\n` +
                `⏭️ Skipped: ${skipped}\n` +
                `❌ Errors: ${errors}`
            )
            .setColor(errors > 0 ? "#FFA500" : "#00FF00")
            .setTimestamp();

        if (errorList.length > 0 && errorList.length <= 10) {
            resultEmbed.addFields({
                name: "Errors/Skips",
                value: errorList.slice(0, 10).join("\n") || "None"
            });
        } else if (errorList.length > 10) {
            resultEmbed.setFooter({ text: `${errorList.length} errors/skips (showing first 10)` });
            resultEmbed.addFields({
                name: "Errors/Skips (first 10)",
                value: errorList.slice(0, 10).join("\n")
            });
        }

        return interaction.editReply({ embeds: [resultEmbed] });

    } catch (error) {
        logError(error, interaction, "sync-rank");
        const errorMsg = `❌ An error occurred while syncing ranks:\n\`\`\`${error.message}\`\`\``;

        if (interaction.deferred || interaction.replied) {
            return interaction.editReply({ content: errorMsg });
        } else {
            return interaction.reply({ content: errorMsg, flags: 64 });
        }
    }
}
