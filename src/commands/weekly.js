import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { findLeaderboardUsers } from "../db/firestore.js";
import { embedColor } from "../utils/helpers.js";
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("weekly")
    .setDescription("Show the current Weekly Leaderboard (XP & Guide Points).");

export async function execute(interaction) {
    const commandName = "weekly";
    try {
        await interaction.deferReply();

        // 1. Get Top 10 Weekly XP (Climber)
        const climbers = await findLeaderboardUsers('weeklyXp', 10, 0);

        // 2. Get Top 10 Weekly Guide Points (Host)
        const hosts = await findLeaderboardUsers('weeklyGuidePoints', 10, 0);

        // 3. Get Top 10 Weekly Expeditions
        const expeditions = await findLeaderboardUsers('weeklyExpeditions', 10, 0);

        // Format Climber List (English)
        let climberDesc = "";
        let climberCount = 0;
        if (climbers.length > 0) {
            climbers.forEach((u, i) => {
                if (u.weeklyXp > 0) {
                    climberDesc += `**${i + 1}.** ${u.robloxUsername} — **${u.weeklyXp}** Lunar Points\n`;
                    climberCount++;
                }
            });
        }
        if (climberCount === 0) climberDesc = "No one has gained Lunar Points this week yet.";

        // Format Host List (English)
        let hostDesc = "";
        let hostCount = 0;
        if (hosts.length > 0) {
            hosts.forEach((u, i) => {
                if (u.weeklyGuidePoints > 0) {
                    hostDesc += `**${i + 1}.** ${u.robloxUsername} — **${u.weeklyGuidePoints}** Points\n`;
                    hostCount++;
                }
            });
        }
        if (hostCount === 0) hostDesc = "No active guides this week yet.";

        // Format Expedition List
        let expeditionDesc = "";
        let expeditionCount = 0;
        if (expeditions.length > 0) {
            expeditions.forEach((u, i) => {
                if (u.weeklyExpeditions > 0) {
                    expeditionDesc += `**${i + 1}.** ${u.robloxUsername} — **${u.weeklyExpeditions}** Expeditions\n`;
                    expeditionCount++;
                }
            });
        }
        if (expeditionCount === 0) expeditionDesc = "No expeditions this week yet.";

        // 3. Create Embed
        const embed = new EmbedBuilder()
            .setTitle("📅 Weekly Leaderboard")
            .setColor(embedColor)
            .setDescription("These statistics reset automatically every Monday at 00:00 WIB.")
            .addFields(
                { name: "🧗 Top Climbers (Weekly LP)", value: climberDesc, inline: true },
                { name: "🧭 Top Hosts (Weekly Guide)", value: hostDesc, inline: true },
                { name: "🚀 Top Expeditions (Weekly)", value: expeditionDesc, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: "Mooncrest Expedition • Weekly Stats" });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An error occurred while fetching weekly data." });
        } else {
            await interaction.reply({ content: "❌ An error occurred.", ephemeral: true });
        }
    }
}