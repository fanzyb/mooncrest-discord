import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { sendModLog } from "../../utils/modLogger.js";
import { parseDuration } from "../../utils/parsing.js";

export const data = new SlashCommandBuilder()
    .setName("mute")
    .setDescription("Mutes a member (timeout) for a specific duration.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName("target").setDescription("The user to mute.").setRequired(true))
    .addStringOption(opt => opt.setName("duration").setDescription("Duration (e.g., 1d, 6h, 30m, 1h30m). Max 28 days.").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for the mute.").setRequired(false));

export async function execute(interaction) {
    const target = interaction.options.getMember("target");
    const durationString = interaction.options.getString("duration");
    const reason = interaction.options.getString("reason") || "No reason provided.";

    if (!target) {
        return interaction.reply({ content: "User not found.", ephemeral: true });
    }

    if (!target.moderatable) {
        return interaction.reply({ content: "❌ I cannot mute this user. They may have a higher role or I lack permissions.", ephemeral: true });
    }

    const durationMs = parseDuration(durationString);
    if (!durationMs) {
        return interaction.reply({ content: "❌ Invalid duration format. Use '1d', '6h', '30m', etc.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        await target.timeout(durationMs, reason);

        await sendModLog(
            interaction.guild,
            "User Muted",
            "#FFFF00",
            target.user,
            interaction.user,
            reason,
            [{ name: "Duration", value: durationString }]
        );

        await interaction.editReply({ content: `✅ Successfully muted **${target.user.tag}** for ${durationString}.` });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while muting this user." });
    }
}