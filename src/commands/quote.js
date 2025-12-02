import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { generateContent } from "../utils/geminiHandler.js";
import { embedColor } from "../utils/helpers.js";

export const data = new SlashCommandBuilder()
    .setName("quote")
    .setDescription("Get a random motivational quote from Gemini AI.")
    .addStringOption(option =>
        option.setName("topic")
            .setDescription("Specific topic for the quote (optional).")
            .setRequired(false)
    );

export async function execute(interaction) {
    await interaction.deferReply();

    const topic = interaction.options.getString("topic") || "Motivation, Stoicism, or Wisdom";

    const systemPrompt = `
    You are a wise philosopher and motivator.
    Generate a short, powerful, and inspiring quote about: "${topic}".
    
    INSTRUCTIONS:
    1. The quote must be in English (primary) but you can include an Indonesian translation below it if appropriate.
    2. Format: "The Quote" - Author (if known) or "Unknown".
    3. Keep it concise (max 280 characters).
    4. Do not add any introductory text like "Here is a quote". Just the quote.
    `;

    try {
        const quote = await generateContent(`Give me a quote about ${topic}.`, systemPrompt);

        if (!quote) {
            return interaction.editReply({ content: "❌ Failed to generate a quote. Please try again later." });
        }

        const embed = new EmbedBuilder()
            .setTitle("✨ Quote of the Moment")
            .setDescription(quote)
            .setColor(embedColor)
            .setFooter({ text: `Topic: ${topic} | Powered by Gemini AI` })
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        console.error("[Quote Command Error]", error);
        await interaction.editReply({ content: "❌ An error occurred while fetching the quote." });
    }
}
