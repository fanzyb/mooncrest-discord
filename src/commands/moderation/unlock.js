import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("unlock")
    .setDescription("Unlocks a channel, allowing members to send messages.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt => 
        opt.setName("channel")
           .setDescription("The channel to unlock (defaults to current).")
           .addChannelTypes(ChannelType.GuildText)
           .setRequired(false)
    );

export async function execute(interaction) {
    const channel = interaction.options.getChannel("channel") || interaction.channel;

    if (channel.type !== ChannelType.GuildText) {
        return interaction.reply({ content: "❌ This command can only be used in text channels.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: null // null resets to default
        });

        await channel.send(`🔓 This channel has been unlocked.`);
        await interaction.editReply({ content: `✅ Channel ${channel} has been unlocked.` });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while unlocking the channel." });
    }
}