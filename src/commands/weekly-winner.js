import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { findUserByDiscordId, saveWeeklyWinner } from "../db/firestore.js";
import { embedColor, rewardManagerRoles } from "../utils/helpers.js";
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("weekly-winner")
    .setDescription("Record the Host or Climber of the Week (Manual Input)")
    .addStringOption(option =>
        option.setName("category")
            .setDescription("Category of the winner")
            .setRequired(true)
            .addChoices(
                { name: "🧭 Host of the Week", value: "host" },
                { name: "🧗 Climber of the Week", value: "climber" }
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
    .addStringOption(option =>
        option.setName("week_start")
            .setDescription("Week start date (YYYY-MM-DD format, e.g., 2025-12-01)")
            .setRequired(true))
    .addStringOption(option =>
        option.setName("reason")
            .setDescription("Reason for the award (optional)")
            .setRequired(false));

export async function execute(interaction) {
    const commandName = "weekly-winner";
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
        const weekStart = interaction.options.getString("week_start");
        const reason = interaction.options.getString("reason") || "";

        // 3. Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(weekStart)) {
            return interaction.editReply({
                content: "❌ Invalid date format. Please use YYYY-MM-DD format (e.g., 2025-12-01)",
                ephemeral: true
            });
        }

        // Validate date is valid
        const testDate = new Date(weekStart);
        if (isNaN(testDate.getTime())) {
            return interaction.editReply({
                content: "❌ Invalid date. Please provide a valid date in YYYY-MM-DD format.",
                ephemeral: true
            });
        }

        // 4. Find linked Roblox user
        const linkedUser = await findUserByDiscordId(targetUser.id);

        if (!linkedUser) {
            return interaction.editReply({
                content: `❌ ${targetUser.tag} has not linked their Roblox account yet. They must use \`/verify\` first.`,
                ephemeral: true
            });
        }

        // 5. Save to Firestore
        await saveWeeklyWinner(category, linkedUser, weekStart, value, reason);

        // 6. Create success embed
        const categoryDisplay = category === 'host' ? '🧭 Host of the Week' : '🧗 Climber of the Week';
        const valueLabel = category === 'host' ? 'Guide Points' : 'Lunar Points';

        const embed = new EmbedBuilder()
            .setTitle("🏆 Weekly Winner Recorded!")
            .setColor(embedColor)
            .setDescription(`Successfully recorded **${categoryDisplay}** for week starting **${weekStart}**`)
            .addFields(
                { name: "👤 Winner", value: `${linkedUser.robloxUsername} (${targetUser.tag})`, inline: true },
                { name: `${valueLabel}`, value: `**${value}**`, inline: true },
                { name: "📅 Week Start", value: weekStart, inline: true }
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
