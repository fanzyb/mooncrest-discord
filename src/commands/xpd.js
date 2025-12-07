import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getRobloxUser, isInRobloxGroup, getLevel, embedColor, getRobloxRankName, getRobloxUserById } from "../utils/helpers.js";
import { findUserByDiscordId, saveUser } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";
import { syncRobloxRank } from "../utils/robloxSync.js";

export const data = new SlashCommandBuilder()
    .setName("xpd")
    .setDescription("Manage a linked Discord user's Lunar Points (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add Lunar Points and expedition count to a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount").setRequired(true))
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
        sub.setName("remove").setDescription("Remove Lunar Points and expedition count from a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount").setRequired(true))
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
        sub.setName("set").setDescription("Set Lunar Points for a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("bonus").setDescription("Give bonus Lunar Points to a linked user (no expedition count)")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Bonus Lunar Points amount").setRequired(true))
            .addStringOption(opt => opt.setName("reason").setDescription("Optional reason for the bonus").setRequired(false))
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
        console.error("[Autocomplete Error] xpd.js:", error);
    }
}

export async function execute(interaction) {
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.xpManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", flags: 64 });

        await interaction.deferReply({ ephemeral: false });

        const action = interaction.options.getSubcommand();
        const member = interaction.options.getMember("member");
        const amount = interaction.options.getInteger("amount");
        const mountainName = interaction.options.getString("mountain_name");
        const difficulty = interaction.options.getString("difficulty");
        const reason = interaction.options.getString("reason");

        // Validate Mountain Name if provided
        if (mountainName && !(config.mountains || []).includes(mountainName)) {
            return interaction.editReply({ content: `❌ Invalid Mountain Name: **${mountainName}**. Please use autocomplete to select a valid mountain.` });
        }

        const userFromDb = await findUserByDiscordId(member.id);
        if (!userFromDb) {
            return interaction.editReply({ content: `❌ User <@${member.id}> is not linked to a Roblox account.` });
        }

        const robloxData = await getRobloxUserById(userFromDb.robloxId);
        if (!robloxData) {
            console.error(`[XPD Error] Failed to fetch Roblox user by ID: ${userFromDb.robloxId}`);
            return interaction.editReply({ content: "⚠️ Linked Roblox user not found (API Error)." });
        }

        const inGroup = await isInRobloxGroup(robloxData.id, config.groupId);
        if (!inGroup) return interaction.editReply({ content: "❌ The linked user is not in the community group." });

        let user = userFromDb;
        const oldLevel = getLevel(user.xp).levelName;

        if (action === "add") {
            user.xp += amount;
            user.weeklyXp = (user.weeklyXp || 0) + amount; // --- [BARU]
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
            user.weeklyXp = Math.max((user.weeklyXp || 0) - amount, 0); // --- [BARU]
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
        } else if (action === "bonus") {
            user.xp += amount;
            user.weeklyXp = (user.weeklyXp || 0) + amount; // --- [BARU]
            user.monthlyXp = (user.monthlyXp || 0) + amount;
        }

        await saveUser(user);

        const newLevel = getLevel(user.xp).levelName;
        let levelMsg = newLevel !== oldLevel ? ` 🎉 **${robloxData.name} has leveled up to ${newLevel}!**` : "";
        let responseMessage = `✅ Successfully performed '${action}' action with ${amount} Lunar Points for **${robloxData.name}** (linked to <@${member.id}>).${levelMsg}`;

        if (action === "bonus") {
            responseMessage = `✅ Gave **${amount}** bonus Lunar Points to **${robloxData.name}** (linked to <@${member.id}>).${levelMsg}`;
            if (reason) responseMessage += `\n*Reason: ${reason}*`;
        }

        // Auto Role Logic (Sama seperti file asli)
        if (newLevel !== oldLevel) {
            // Auto-sync Roblox rank
            syncRobloxRank(user.robloxId, user.xp, interaction.client).catch(err => {
                console.error('[XPD] Roblox rank sync error:', err);
            });

            const rankMapping = config.rankToRoleMapping || {};
            const targetRoleId = rankMapping[newLevel];
            if (targetRoleId) {
                const targetRole = interaction.guild.roles.cache.get(targetRoleId);
                if (targetRole) {
                    const allRankRoleIds = Object.values(rankMapping);
                    const rolesToRemove = member.roles.cache.filter(role => allRankRoleIds.includes(role.id));
                    if (rolesToRemove.size > 0) await member.roles.remove(rolesToRemove);
                    await member.roles.add(targetRole);
                    responseMessage += `\n👑 Their role has been updated to **${targetRole.name}**!`;
                }
            }
        }

        await interaction.editReply({ content: responseMessage });

        // Logging (Sama seperti file asli)
        try {
            const xpLogChannel = interaction.guild.channels.cache.get(config.xpLogChannelId);
            if (xpLogChannel) {
                const logFields = [
                    { name: "Action", value: action, inline: true },
                    { name: "Amount", value: amount.toString(), inline: true },
                    { name: "Target Discord", value: `<@${member.id}>`, inline: true },
                    { name: "Target Roblox", value: `${robloxData.name}`, inline: true },
                    { name: "By", value: interaction.user.tag, inline: true },
                    { name: "New Lunar Points", value: user.xp.toString(), inline: true },
                    { name: "New Expeditions", value: user.expeditions.toString(), inline: true }
                ];
                if (mountainName) logFields.push({ name: "Mountain", value: mountainName, inline: true });
                if (difficulty) logFields.push({ name: "Difficulty", value: difficulty, inline: true });
                if (reason) logFields.push({ name: "Reason", value: reason });
                const logEmbed = new EmbedBuilder().setTitle(`📊 Lunar Points Log (${action.toUpperCase()})`).setColor(embedColor).addFields(logFields).setTimestamp();
                await xpLogChannel.send({ embeds: [logEmbed] });
            }
        } catch (logErr) { }

    } catch (error) {
        logError(error, interaction, "xpd");
        await interaction.editReply({ content: "❌ Error processing command." });
    }
}