import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { findLeaderboardUsers } from "../db/firestore.js";
import { embedColor } from "../utils/helpers.js";
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("monthly")
    .setDescription("Show the current Monthly Leaderboard.");

export async function execute(interaction) {
    try {
        await interaction.deferReply();

        const climbers = await findLeaderboardUsers('monthlyXp', 10, 0);
        const hosts = await findLeaderboardUsers('monthlyGuidePoints', 10, 0);
        const expeditions = await findLeaderboardUsers('monthlyExpeditions', 10, 0);

        let climberDesc = "";
        if (climbers.length > 0) {
            climbers.forEach((u, i) => {
                if (u.monthlyXp > 0) climberDesc += `**${i + 1}.** ${u.robloxUsername} — **${u.monthlyXp}** Lunar Points\n`;
            });
        }
        if (!climberDesc) climberDesc = "No data yet this month.";

        let hostDesc = "";
        if (hosts.length > 0) {
            hosts.forEach((u, i) => {
                if (u.monthlyGuidePoints > 0) hostDesc += `**${i + 1}.** ${u.robloxUsername} — **${u.monthlyGuidePoints}** Points\n`;
            });
        }
        if (!hostDesc) hostDesc = "No data yet this month.";

        let expeditionDesc = "";
        if (expeditions.length > 0) {
            expeditions.forEach((u, i) => {
                if (u.monthlyExpeditions > 0) expeditionDesc += `**${i + 1}.** ${u.robloxUsername} — **${u.monthlyExpeditions}** Expeditions\n`;
            });
        }
        if (!expeditionDesc) expeditionDesc = "No data yet this month.";

        const embed = new EmbedBuilder()
            .setTitle("🌕 Monthly Leaderboard")
            .setColor(embedColor)
            .setDescription("Resets automatically on the 1st of every month.")
            .addFields(
                { name: "🧗 Top Climbers (Monthly LP)", value: climberDesc, inline: true },
                { name: "🧭 Top Hosts (Monthly)", value: hostDesc, inline: true },
                { name: "🚀 Top Expeditions (Monthly)", value: expeditionDesc, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logError(error, interaction, "monthly");
    }
}