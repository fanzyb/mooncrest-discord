import { SlashCommandBuilder } from "discord.js";
import { generateLeaderboardEmbed } from "../utils/components.js";

export const data = new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show Lunar Points or Expedition leaderboard") // <-- [GANTI]
    .addStringOption(opt =>
        opt.setName("type")
            .setDescription("Type of leaderboard (Lunar Points or Expedition)") // <-- [GANTI]
            .setRequired(false)
            .addChoices(
                { name: 'Lunar Points', value: 'xp' }, // <-- [GANTI]
                { name: 'Expedition', value: 'expo' },
            )
    )
    .addIntegerOption(opt => opt.setName("page").setDescription("Page number").setRequired(false));

export async function execute(interaction) {
    const page = interaction.options.getInteger("page") || 1;
    const type = interaction.options.getString("type") || 'xp'; // <-- Biarkan 'xp'

    const leaderboardPayload = await generateLeaderboardEmbed(page, type);

    await interaction.reply(leaderboardPayload);
}