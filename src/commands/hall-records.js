import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { getHallRecords } from "../db/firestore.js";
import { embedColor } from "../utils/helpers.js";
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("hall-records")
    .setDescription("View Hall of Fame Records (Monthly or Weekly Winners)")
    .addStringOption(option =>
        option.setName("period")
            .setDescription("Period type")
            .setRequired(true)
            .addChoices(
                { name: "📅 Monthly", value: "monthly" },
                { name: "🗓️ Weekly", value: "weekly" }
            ))
    .addIntegerOption(option =>
        option.setName("year")
            .setDescription("Year to view (e.g., 2025)")
            .setRequired(true)
            .setMinValue(2024));

export async function execute(interaction) {
    const commandName = "hall-records";
    try {
        await interaction.deferReply();

        const period = interaction.options.getString("period");
        const year = interaction.options.getInteger("year");

        // Get records from Firestore
        const records = await getHallRecords(period, year);

        if (records.length === 0) {
            return interaction.editReply({
                content: `📭 No ${period} records found for year ${year}.`
            });
        }

        // Build embed
        const periodDisplay = period === 'monthly' ? 'Monthly' : 'Weekly';
        const embed = new EmbedBuilder()
            .setTitle(`🏆 Hall of Fame - ${periodDisplay} Records ${year}`)
            .setColor(embedColor)
            .setDescription(`Showing all ${periodDisplay.toLowerCase()} winners for ${year}`)
            .setTimestamp();

        // Format records
        let description = '';

        for (const record of records) {
            const dateLabel = period === 'monthly'
                ? `**${getMonthName(record.month)} ${record.year}**`
                : `**Week of ${record.weekStartDate}**`;

            description += `\n${dateLabel}\n`;

            // Host information
            if (period === 'monthly' && record.hostOfTheMonth) {
                const host = record.hostOfTheMonth;
                description += `🧭 **Host:** ${host.robloxUsername} - ${host.points} Points`;
                if (host.reason) description += ` _(${host.reason})_`;
                description += '\n';
            } else if (period === 'weekly' && record.hostOfTheWeek) {
                const host = record.hostOfTheWeek;
                description += `🧭 **Host:** ${host.robloxUsername} - ${host.points} Points`;
                if (host.reason) description += ` _(${host.reason})_`;
                description += '\n';
            }

            // Climber information
            if (period === 'monthly' && record.climberOfTheMonth) {
                const climber = record.climberOfTheMonth;
                description += `🧗 **Climber:** ${climber.robloxUsername} - ${climber.lunarPoints} LP`;
                if (climber.reason) description += ` _(${climber.reason})_`;
                description += '\n';
            } else if (period === 'weekly' && record.climberOfTheWeek) {
                const climber = record.climberOfTheWeek;
                description += `🧗 **Climber:** ${climber.robloxUsername} - ${climber.lunarPoints} LP`;
                if (climber.reason) description += ` _(${climber.reason})_`;
                description += '\n';
            }
        }

        // Check if description is too long (Discord limit is 4096 characters)
        if (description.length > 4000) {
            // Split into multiple embeds if needed
            const chunks = splitDescription(description, 3900);

            for (let i = 0; i < chunks.length; i++) {
                const chunkEmbed = new EmbedBuilder()
                    .setTitle(i === 0 ? `🏆 Hall of Fame - ${periodDisplay} Records ${year}` : `🏆 Continued...`)
                    .setColor(embedColor)
                    .setDescription(chunks[i])
                    .setFooter({ text: `Page ${i + 1}/${chunks.length}` });

                if (i === 0) {
                    await interaction.editReply({ embeds: [chunkEmbed] });
                } else {
                    await interaction.followUp({ embeds: [chunkEmbed] });
                }
            }
        } else {
            embed.setDescription(description);
            embed.setFooter({ text: `Total ${period} records: ${records.length}` });
            await interaction.editReply({ embeds: [embed] });
        }

    } catch (error) {
        logError(error, interaction, commandName);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: `❌ An error occurred while fetching records: ${error.message}`
            });
        } else {
            await interaction.reply({
                content: "❌ An error occurred.",
                ephemeral: true
            });
        }
    }
}

// Helper function to get month name
function getMonthName(month) {
    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"];
    return monthNames[month - 1];
}

// Helper function to split long descriptions
function splitDescription(text, maxLength) {
    const chunks = [];
    const lines = text.split('\n');
    let currentChunk = '';

    for (const line of lines) {
        if ((currentChunk + line + '\n').length > maxLength) {
            chunks.push(currentChunk);
            currentChunk = line + '\n';
        } else {
            currentChunk += line + '\n';
        }
    }

    if (currentChunk) {
        chunks.push(currentChunk);
    }

    return chunks;
}
