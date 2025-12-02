import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { embedColor, achievementsConfig } from "../utils/helpers.js";

export const data = new SlashCommandBuilder()
    .setName("list-reward")
    .setDescription("Show all available achievements/rewards");

export async function execute(interaction) {
    if (!achievementsConfig.length) {
        return interaction.reply({ content: "⚠️ No achievements configured in config.json.", ephemeral: true });
    }

    let desc = "";
    for (const achv of achievementsConfig) {
        desc += `**🎖️ ${achv.name}**\n↳ *${achv.description || "No description provided."}*\n`;
    }

    const embed = new EmbedBuilder()
        .setTitle("List of All Achievements")
        .setColor(embedColor)
        .setDescription(desc)
        .setTimestamp();
    return interaction.reply({ embeds: [embed] });
}