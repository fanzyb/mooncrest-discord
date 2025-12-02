import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("lock")
    .setDescription("Locks a channel, preventing members from sending messages.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
    .addChannelOption(opt => 
        opt.setName("channel")
           .setDescription("The channel to lock (defaults to current).")
           .addChannelTypes(ChannelType.GuildText)
           .setRequired(false)
    )
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for the lock.").setRequired(false));

export async function execute(interaction) {
    const channel = interaction.options.getChannel("channel") || interaction.channel;
    const reason = interaction.options.getString("reason") || "No reason provided.";

    if (channel.type !== ChannelType.GuildText) {
        return interaction.reply({ content: "❌ This command can only be used in text channels.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        await channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
            SendMessages: false
        });

        await channel.send(`🔒 This channel has been locked by a moderator. Reason: ${reason}`);
        await interaction.editReply({ content: `✅ Channel ${channel} has been locked.` });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while locking the channel." });
    }
}