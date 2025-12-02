import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { findUserByDiscordId, saveMonthlyWinner } from "../db/firestore.js";
import { embedColor, rewardManagerRoles } from "../utils/helpers.js";
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("monthly-winner")
    .setDescription("Record the Host or Climber of the Month (Manual Input)")
    .addStringOption(option =>
        option.setName("category")
            .setDescription("Category of the winner")
            .setRequired(true)
            .addChoices(
                { name: "🧭 Host of the Month", value: "host" },
                { name: "🧗 Climber of the Month", value: "climber" }
            ))
    .addUserOption(option =>
        option.setName("user")
            .setDescription("Discord user to award")
            .setRequired(true))
    .addIntegerOption(option =>
        option.setName("value")
            .setDescription("Points (for Host) or Lunar Points (for Climber)")
            .setRequired(true)
            .setMinValue(1))
    .addIntegerOption(option =>
        option.setName("month")
            .setDescription("Month number (1-12)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(12))
    .addIntegerOption(option =>
        option.setName("year")
            .setDescription("Year (e.g., 2025)")
            .setRequired(true)
            .setMinValue(2024))
    .addStringOption(option =>
        option.setName("reason")
            .setDescription("Reason for the award (optional)")
            .setRequired(false));

export async function execute(interaction) {
    const commandName = "monthly-winner";
    try {
        await interaction.deferReply({ ephemeral: true });

        // 1. Permission Check
        const member = interaction.member;
        const hasPermission = member.roles.cache.some(role => rewardManagerRoles.includes(role.id));

        if (!hasPermission) {
            return interaction.editReply({
                content: "❌ You do not have permission to use this command. Only Reward Managers can record winners.",
                ephemeral: true
            });
        }

        // 2. Get options
        const category = interaction.options.getString("category");
        const targetUser = interaction.options.getUser("user");
        const value = interaction.options.getInteger("value");
        const month = interaction.options.getInteger("month");
        const year = interaction.options.getInteger("year");
        const reason = interaction.options.getString("reason") || "";

        // 3. Find linked Roblox user
        const linkedUser = await findUserByDiscordId(targetUser.id);

        if (!linkedUser) {
            return interaction.editReply({
                content: `❌ ${targetUser.tag} has not linked their Roblox account yet. They must use \`/verify\` first.`,
                ephemeral: true
            });
        }

        // 4. Save to Firestore
        await saveMonthlyWinner(category, linkedUser, month, year, value, reason);

        // 5. Create success embed
        const monthNames = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"];
        const monthName = monthNames[month - 1];

        const categoryDisplay = category === 'host' ? '🧭 Host of the Month' : '🧗 Climber of the Month';
        const valueLabel = category === 'host' ? 'Guide Points' : 'Lunar Points';

        const embed = new EmbedBuilder()
            .setTitle("🏆 Monthly Winner Recorded!")
            .setColor(embedColor)
            .setDescription(`Successfully recorded **${categoryDisplay}** for **${monthName} ${year}**`)
            .addFields(
                { name: "👤 Winner", value: `${linkedUser.robloxUsername} (${targetUser.tag})`, inline: true },
                { name: `${valueLabel}`, value: `**${value}**`, inline: true },
                { name: "📅 Period", value: `${monthName} ${year}`, inline: true }
            )
            .setTimestamp();

        if (reason) {
            embed.addFields({ name: "📝 Reason", value: reason });
        }

        await interaction.editReply({ embeds: [embed], ephemeral: true });

    } catch (error) {
        logError(error, interaction, commandName);

        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({
                content: `❌ An error occurred while recording the winner: ${error.message}`,
                ephemeral: true
            });
        } else {
            await interaction.reply({
                content: "❌ An error occurred.",
                ephemeral: true
            });
        }
    }
}
