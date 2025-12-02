import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import { parseDuration } from "../../utils/parsing.js";

export const data = new SlashCommandBuilder()
    .setName("slowmode")
    .setDescription("Sets the slowmode for a channel.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addStringOption(opt => 
        opt.setName("duration")
           .setDescription("Duration (e.g., '5s', '1m', '0' to disable). Max 6h.")
           .setRequired(true)
    );

export async function execute(interaction) {
    const durationString = interaction.options.getString("duration");
    const channel = interaction.channel;

    if (channel.type !== ChannelType.GuildText) {
        return interaction.reply({ content: "❌ This command can only be used in text channels.", ephemeral: true });
    }

    const durationMs = parseDuration(durationString);
    if (durationMs === null) {
        return interaction.reply({ content: "❌ Invalid duration format. Use '5s', '10m', etc.", ephemeral: true });
    }

    const durationSeconds = durationMs / 1000;

    if (durationSeconds > 21600) { // 6 hours
        return interaction.reply({ content: "❌ Slowmode duration cannot exceed 6 hours.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        await channel.setRateLimitPerUser(durationSeconds, `Slowmode set by ${interaction.user.tag}`);

        if (durationSeconds === 0) {
            await interaction.editReply({ content: `✅ Slowmode has been disabled for this channel.` });
        } else {
            await interaction.editReply({ content: `✅ Slowmode has been set to **${durationString}** for this channel.` });
        }

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while setting slowmode." });
    }
}