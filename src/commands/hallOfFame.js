import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { embedColor, achievementsConfig } from "../utils/helpers.js";
import { getAllUsers } from "../db/firestore.js";

export const data = new SlashCommandBuilder()
    .setName("hall-of-fame")
    .setDescription("Show climbers with achievements");

export async function execute(interaction) {
    await interaction.deferReply();

    const allUsers = await getAllUsers();

    // Sort by 'xp' (database key)
    let users = allUsers
        .filter(u => u.achievements && u.achievements.length > 0)
        .sort((a, b) => (b.xp || 0) - (a.xp || 0)); 

    if (!users.length) return interaction.editReply({ content: "⚠️ No climbers with achievements yet." });

    let desc = "";
    for (const u of users) {
        const list = (u.achievements || [])
            .map(id => achievementsConfig.find(a => a.id === id)?.name)
            .filter(Boolean)
            .join(", ");
        desc += `🏅 **${u.robloxUsername}** (Lunar Points: ${u.xp || 0}) → ${list}\n`; // <-- [GANTI]
    }

    const embed = new EmbedBuilder()
        .setTitle("🏆 Hall of Fame")
        .setColor(embedColor)
        .setDescription(desc)
        .setTimestamp();
    return interaction.editReply({ embeds: [embed] });
}