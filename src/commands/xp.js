import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getRobloxUser, isInRobloxGroup, getLevel, embedColor } from "../utils/helpers.js";
import { findUser, saveUser } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";
import { syncRobloxRank } from "../utils/robloxSync.js";

export const data = new SlashCommandBuilder()
    .setName("xp")
    .setDescription("Manage user Lunar Points (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add Lunar Points and expedition count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
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
        sub.setName("remove").setDescription("Remove Lunar Points and expedition count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
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
        sub.setName("set").setDescription("Set Lunar Points")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Lunar Points amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("bonus").setDescription("Give bonus Lunar Points without adding expedition count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
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
        console.error("[Autocomplete Error] xp.js:", error);
    }
}

export async function execute(interaction) {
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.xpManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", flags: 64 });

        const action = interaction.options.getSubcommand();
        const username = interaction.options.getString("username");
        const amount = interaction.options.getInteger("amount");
        const mountainName = interaction.options.getString("mountain_name");
        const difficulty = interaction.options.getString("difficulty");
        const reason = interaction.options.getString("reason");

        await interaction.deferReply({ ephemeral: false });

        // Validate Mountain Name if provided
        if (mountainName && !(config.mountains || []).includes(mountainName)) {
            return interaction.editReply({ content: `❌ Invalid Mountain Name: **${mountainName}**. Please use autocomplete to select a valid mountain.` });
        }

        const robloxData = await getRobloxUser(username);
        if (!robloxData) return interaction.editReply({ content: "⚠️ Roblox user not found." });

        const inGroup = await isInRobloxGroup(robloxData.id, config.groupId);
        if (!inGroup) return interaction.editReply({ content: "❌ User is not in the community group." });

        let user = await findUser(robloxData.id.toString());
        if (!user) user = { robloxId: robloxData.id.toString(), robloxUsername: robloxData.name, xp: 0, weeklyXp: 0, expeditions: 0, achievements: [] };

        const oldLevel = getLevel(user.xp).levelName;

        if (action === "add") {
            user.xp += amount;
            user.weeklyXp = (user.weeklyXp || 0) + amount; // --- [BARU] Update Mingguan
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
            // Weekly juga dikurangi, tapi jangan sampe minus
            user.weeklyXp = Math.max((user.weeklyXp || 0) - amount, 0);
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
            // Kalau SET, weekly biarin aja atau reset? Biasanya biarin aja biar ga ngerusak leaderboard mingguan.
        } else if (action === "bonus") {
            user.xp += amount;
            user.weeklyXp = (user.weeklyXp || 0) + amount; // --- [BARU] Update Mingguan
            user.monthlyXp = (user.monthlyXp || 0) + amount;
        }

        await saveUser(user);

        const newLevel = getLevel(user.xp).levelName;
        const levelMsg = newLevel !== oldLevel ? ` 🎉 **${robloxData.name} has leveled up to ${newLevel}!**` : "";

        // Auto-sync Roblox rank if level changed
        if (newLevel !== oldLevel) {
            syncRobloxRank(user.robloxId, user.xp).catch(err => {
                console.error('[XP] Roblox rank sync error:', err);
            });
        }
        let responseMessage = `✅ Successfully performed '${action}' action with ${amount} Lunar Points for **${robloxData.name}**.${levelMsg}`;

        if (action === "bonus") {
            responseMessage = `✅ Gave **${amount}** bonus Lunar Points to **${robloxData.name}**.${levelMsg}`;
            if (reason) responseMessage += `\n*Reason: ${reason}*`;
        }

        await interaction.editReply({ content: responseMessage });

        // Logging (Sama kayak sebelumnya)
        try {
            const logFields = [
                { name: "Action", value: action.charAt(0).toUpperCase() + action.slice(1), inline: true },
                { name: "Amount", value: amount.toString(), inline: true },
                { name: "Target", value: `${robloxData.name} (${robloxData.id})`, inline: true },
                { name: "By", value: interaction.user.tag, inline: true },
                { name: "New Lunar Points", value: user.xp.toString(), inline: true },
                { name: "New Expeditions", value: user.expeditions.toString(), inline: true }
            ];
            if (action === "add" || action === "remove") {
                logFields.push({ name: "Total Expeditions", value: (user.expeditions || 0).toString(), inline: true });
                if (mountainName) logFields.push({ name: "Mountain", value: mountainName, inline: true });
                if (difficulty) logFields.push({ name: "Difficulty", value: difficulty, inline: true });
            }
            if (reason) {
                logFields.push({ name: "Reason", value: reason });
            }

            const xpLogChannel = interaction.guild.channels.cache.get(config.xpLogChannelId);
            if (xpLogChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle(`📊 Lunar Points Log (${action.charAt(0).toUpperCase() + action.slice(1)})`)
                    .setColor(embedColor)
                    .addFields(logFields)
                    .setTimestamp();
                await xpLogChannel.send({ embeds: [logEmbed] });
            }
        } catch (logErr) { console.error("Log Error", logErr); }

    } catch (error) {
        logError(error, interaction, "xp");
        await interaction.editReply({ content: "❌ Error processing command." });
    }
}