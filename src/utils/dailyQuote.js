import cron from "node-cron";
import { EmbedBuilder } from "discord.js";
import config from "../config.json" with { type: "json" };
import { generateContent } from "./geminiHandler.js";
import { embedColor } from "./helpers.js";

const TIMEZONE = "Asia/Jakarta";

export function initDailyQuote(client) {
    // Schedule: Every day at 08:00 WIB
    // Cron format: Minute Hour Day Month DayOfWeek
    cron.schedule('0 8 * * *', async () => {
        console.log('[DailyQuote] 🌅 Fetching daily quote...');

        const channelId = config.dailyQuoteChannelId;
        if (!channelId) {
            console.warn('[DailyQuote] ⚠️ No dailyQuoteChannelId configured in config.json. Skipping.');
            return;
        }

        const channel = client.channels.cache.get(channelId);
        if (!channel) {
            console.warn(`[DailyQuote] ⚠️ Channel ID ${channelId} not found.`);
            return;
        }

        const topic = "Motivation, Stoicism, Wisdom, or Discipline";
        const systemPrompt = `
        You are a wise mentor.
        Generate a "Quote of the Day" about: "${topic}".
        
        INSTRUCTIONS:
        1. The quote must be in English.
        2. Include a brief, inspiring explanation or reflection (1-2 sentences) below the quote in Indonesian.
        3. Format:
           "The Quote"
           - Author
           
           *Refleksi:* [Indonesian reflection]
        4. Keep it visually appealing.
        `;

        try {
            const content = await generateContent(`Give me a daily quote about ${topic}.`, systemPrompt);

            if (content) {
                const embed = new EmbedBuilder()
                    .setTitle("🌅 Quote of the Day")
                    .setDescription(content)
                    .setColor(embedColor)
                    .setFooter({ text: "Have a productive day! | Powered by Gemini AI" })
                    .setTimestamp();

                await channel.send({ embeds: [embed] });
                console.log('[DailyQuote] ✅ Quote sent.');
            } else {
                console.error('[DailyQuote] ❌ Failed to generate content.');
            }

        } catch (error) {
            console.error('[DailyQuote] ❌ Error:', error);
        }

    }, {
        scheduled: true,
        timezone: TIMEZONE
    });

    console.log('[DailyQuote] ⏳ Scheduler Active (08:00 WIB)');
}
