import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { findUserByDiscordId, saveUser } from "../db/firestore.js";
import { getLevel, embedColor, syncRankRole } from "../utils/helpers.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";
import { syncRobloxRank } from "../utils/robloxSync.js";

export const data = new SlashCommandBuilder()
    .setName("batch")
    .setDescription("Batch manage Lunar Points/expeditions for multiple users/roles.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add")
            .setDescription("Add Lunar Points & +1 expedition count to multiple users.")
            .addStringOption(opt => opt.setName("targets").setDescription("Users or roles to target (e.g., @user1 @Role)").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount to add to each user.").setRequired(true))
            .addStringOption(opt => opt.setName("mountain_name").setDescription("Search mountain name...").setRequired(true).setAutocomplete(true))
            .addStringOption(opt =>
                opt.setName("difficulty")
                    .setDescription("Expedition difficulty")
                    .setRequired(true)
                    .addChoices(
                        { name: 'Easy', value: 'Easy' },
                        { name: 'Medium', value: 'Medium' },
                        { name: 'Hard', value: 'Hard' },
                        { name: 'Extreme', value: 'Extreme' }
                    )
            )
            .addStringOption(opt => opt.setName("reason").setDescription("Optional reason for this batch.").setRequired(false))
    )
    .addSubcommand(sub =>
        sub.setName("remove")
            .setDescription("Remove Lunar Points & -1 expedition count from multiple users.")
            .addStringOption(opt => opt.setName("targets").setDescription("Users or roles to target (e.g., @user1 @Role)").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount to remove from each user.").setRequired(true))
            .addStringOption(opt => opt.setName("mountain_name").setDescription("Search mountain name...").setRequired(true).setAutocomplete(true))
            .addStringOption(opt =>
                opt.setName("difficulty")
                    .setDescription("Expedition difficulty")
                    .setRequired(true)
                    .addChoices(
                        { name: 'Easy', value: 'Easy' },
                        { name: 'Medium', value: 'Medium' },
                        { name: 'Hard', value: 'Hard' },
                        { name: 'Extreme', value: 'Extreme' }
                    )
            )
    )
    .addSubcommand(sub =>
        sub.setName("set")
            .setDescription("Set a specific Lunar Points amount for multiple users (expeditions unchanged).")
            .addStringOption(opt => opt.setName("targets").setDescription("Users or roles to target (e.g., @user1 @Role)").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("The exact Lunar Points amount to set for each user.").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("bonus")
            .setDescription("Give bonus Lunar Points to multiple users (expeditions unchanged).")
            .addStringOption(opt => opt.setName("targets").setDescription("Users or roles to target (e.g., @user1 @Role)").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Bonus Lunar Points amount to add to each user.").setRequired(true))
            .addStringOption(opt => opt.setName("reason").setDescription("Optional reason for this batch bonus.").setRequired(false))
    );

export async function autocomplete(interaction) {
    try {
        const focusedValue = interaction.options.getFocused().toLowerCase();
        const mountains = config.mountains || [];
        const filtered = mountains.filter(m => m.toLowerCase().includes(focusedValue));

        await interaction.respond(
            filtered.slice(0, 25).map(m => ({ name: m, value: m }))
        );
    } catch (error) {
        console.error("[Autocomplete Error] batch.js:", error);
    }
}

export async function execute(interaction) {
    const commandName = "batch";
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.xpManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });

        await interaction.deferReply({ ephemeral: false });

        const action = interaction.options.getSubcommand();
        const targetsString = interaction.options.getString("targets");
        const amount = interaction.options.getInteger("amount");
        const mountainName = interaction.options.getString("mountain_name");
        const difficulty = interaction.options.getString("difficulty");
        const reason = interaction.options.getString("reason") || `Batch ${action}`;

        // Validate Mountain Name if provided
        if (mountainName && !(config.mountains || []).includes(mountainName)) {
            return interaction.editReply({ content: `❌ Invalid Mountain Name: **${mountainName}**. Please use autocomplete to select a valid mountain.` });
        }

        if (amount < 0) {
            return interaction.editReply({ content: "❌ Amount cannot be a negative number." });
        }

        // --- 1. Kumpulkan Target ---
        const targetUserIds = new Set();
        const userMentionRegex = /<@!?(\d+)>/g;
        const roleMentionRegex = /<@&(\d+)>/g;

        for (const match of targetsString.matchAll(userMentionRegex)) targetUserIds.add(match[1]);

        for (const match of targetsString.matchAll(roleMentionRegex)) {
            const roleId = match[1];
            try {
                const role = await interaction.guild.roles.fetch(roleId);
                if (role) role.members.forEach(m => { if (!m.user.bot) targetUserIds.add(m.id); });
            } catch (err) { console.warn(`[BATCH] Role fetch error: ${err.message}`); }
        }

        if (targetUserIds.size === 0) return interaction.editReply({ content: "⚠️ No valid users or roles found." });

        const logChannel = interaction.guild.channels.cache.get(config.xpLogChannelId);

        // --- 2. Proses ---
        let processedCount = 0, skippedCount = 0;
        const levelUpMessages = [], successUsers = [], skippedUsers = [];

        for (const userId of targetUserIds) {
            try {
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (!member) { skippedCount++; skippedUsers.push(`<@${userId}> (Left)`); continue; }

                const userFromDb = await findUserByDiscordId(userId);
                if (!userFromDb || !userFromDb.isVerified) { skippedCount++; skippedUsers.push(`<@${userId}> (Unverified)`); continue; }

                let user = userFromDb;
                const oldLevel = getLevel(user.xp).levelName;

                if (action === "add") {
                    user.xp += amount;
                    user.weeklyXp = (user.weeklyXp || 0) + amount; // [FIX] Update Weekly
                    user.monthlyXp = (user.monthlyXp || 0) + amount;
                    user.expeditions = (user.expeditions || 0) + 1;
                    user.weeklyExpeditions = (user.weeklyExpeditions || 0) + 1;
                    user.monthlyExpeditions = (user.monthlyExpeditions || 0) + 1;

                    // Update Mountain History
                    if (mountainName) {
                        if (!user.expeditionHistory) user.expeditionHistory = {};
                        user.expeditionHistory[mountainName] = (user.expeditionHistory[mountainName] || 0) + 1;
                    }

                    // Update Difficulty Stats
                    if (difficulty) {
                        if (!user.difficultyStats) user.difficultyStats = {};
                        user.difficultyStats[difficulty] = (user.difficultyStats[difficulty] || 0) + 1;
                    }
                } else if (action === "remove") {
                    user.xp = Math.max(user.xp - amount, 0);
                    user.weeklyXp = Math.max((user.weeklyXp || 0) - amount, 0); // [FIX] Update Weekly
                    user.monthlyXp = Math.max((user.monthlyXp || 0) - amount, 0);
                    user.expeditions = Math.max((user.expeditions || 0) - 1, 0);
                    user.weeklyExpeditions = Math.max((user.weeklyExpeditions || 0) - 1, 0);
                    user.monthlyExpeditions = Math.max((user.monthlyExpeditions || 0) - 1, 0);

                    // Update Mountain History
                    if (mountainName && user.expeditionHistory && user.expeditionHistory[mountainName]) {
                        user.expeditionHistory[mountainName] = Math.max(user.expeditionHistory[mountainName] - 1, 0);
                        if (user.expeditionHistory[mountainName] === 0) delete user.expeditionHistory[mountainName];
                    }

                    // Update Difficulty Stats
                    if (difficulty && user.difficultyStats && user.difficultyStats[difficulty]) {
                        user.difficultyStats[difficulty] = Math.max(user.difficultyStats[difficulty] - 1, 0);
                        if (user.difficultyStats[difficulty] === 0) delete user.difficultyStats[difficulty];
                    }
                } else if (action === "set") {
                    user.xp = amount;
                    // Set biasanya tidak mengubah weekly kecuali logic khusus, biarkan aman
                } else if (action === "bonus") {
                    user.xp += amount;
                    user.weeklyXp = (user.weeklyXp || 0) + amount; // [FIX] Update Weekly
                    user.monthlyXp = (user.monthlyXp || 0) + amount;
                }

                await saveUser(user);

                // Log Level Up
                const newLevel = getLevel(user.xp).levelName;
                if (newLevel !== oldLevel) {
                    // Auto-sync Roblox rank
                    syncRobloxRank(user.robloxId, user.xp).catch(err => {
                        console.error('[BATCH] Roblox rank sync error:', err);
                    });

                    const rankRole = await syncRankRole(member, user.xp);
                    levelUpMessages.push(`🎉 <@${userId}> -> **${newLevel}**${rankRole ? ` (${rankRole.name})` : ""}`);
                }

                // Log Individual
                if (logChannel) {
                    try {
                        const logEmbed = new EmbedBuilder()
                            .setTitle(`📊 Lunar Points Log (Batch ${action})`)
                            .setColor(embedColor)
                            .addFields(
                                { name: "Action", value: action, inline: true },
                                { name: "Amount", value: amount.toString(), inline: true },
                                { name: "Target", value: `<@${user.discordId}> (${user.robloxUsername})`, inline: true },
                                { name: "By", value: interaction.user.tag, inline: true },
                                { name: "New Lunar Points", value: user.xp.toString(), inline: true },
                                { name: "New Expeditions", value: user.expeditions.toString(), inline: true },
                                { name: "Mountain", value: mountainName || "N/A", inline: true },
                                { name: "Difficulty", value: difficulty || "N/A", inline: true },
                                { name: "Reason", value: reason, inline: false }
                            ).setTimestamp();
                        await logChannel.send({ embeds: [logEmbed] });
                    } catch { }
                }

                processedCount++;
                successUsers.push(`<@${userId}>`);

            } catch (error) {
                console.error(`[BATCH] Error processing ${userId}:`, error);
                skippedCount++;
                skippedUsers.push(`<@${userId}> (Error)`);
            }
        }

        // --- 3. Embed Result ---
        const embed = new EmbedBuilder()
            .setTitle(`✅ Batch ${action.toUpperCase()} Complete`)
            .setColor(embedColor)
            .addFields(
                { name: "Success", value: `${processedCount}`, inline: true },
                { name: "Skipped", value: `${skippedCount}`, inline: true },
                { name: "Amount", value: `${amount}`, inline: true }
            ).setTimestamp();

        if (successUsers.length > 0) {
            const successText = successUsers.join(", ").substring(0, 1020);
            embed.addFields({ name: "Processed Users", value: successText.length < successUsers.join(", ").length ? successText + "..." : successText });
        }

        if (levelUpMessages.length > 0) {
            const lvlText = levelUpMessages.join("\n").substring(0, 1020);
            embed.addFields({ name: "🎉 Level Ups", value: lvlText.length < levelUpMessages.join("\n").length ? lvlText + "..." : lvlText });
        }

        if (skippedUsers.length > 0) {
            const skippedText = skippedUsers.join(", ").substring(0, 1020);
            embed.addFields({ name: "⚠️ Skipped Users", value: skippedText.length < skippedUsers.join(", ").length ? skippedText + "..." : skippedText });
        }

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logError(error, interaction, commandName);
        if (!interaction.replied) await interaction.editReply({ content: "❌ Error executing batch command." });
    }
}