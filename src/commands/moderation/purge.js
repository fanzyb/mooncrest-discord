import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("purge")
    .setDescription("Deletes a bulk amount of messages.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addIntegerOption(opt => 
        opt.setName("amount")
           .setDescription("Number of messages to delete (1-100).")
           .setRequired(true)
           .setMinValue(1)
           .setMaxValue(100)
    )
    .addUserOption(opt => 
        opt.setName("user")
           .setDescription("Only delete messages from this user.")
           .setRequired(false)
    );

export async function execute(interaction) {
    const amount = interaction.options.getInteger("amount");
    const targetUser = interaction.options.getUser("user");
    const channel = interaction.channel;

    if (channel.type !== ChannelType.GuildText) {
        return interaction.reply({ content: "❌ This command can only be used in text channels.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const messages = await channel.messages.fetch({ limit: amount });
        let filteredMessages = messages;

        if (targetUser) {
            filteredMessages = messages.filter(msg => msg.author.id === targetUser.id);
        }

        if (filteredMessages.size === 0) {
            return interaction.editReply({ content: "ℹ️ No messages found to delete.", ephemeral: true });
        }

        // Pesan yang lebih tua dari 14 hari tidak bisa di-bulk delete
        const oldMessages = filteredMessages.filter(msg => (Date.now() - msg.createdTimestamp) > 1209600000); // 14 days
        const newMessages = filteredMessages.filter(msg => (Date.now() - msg.createdTimestamp) <= 1209600000);

        let deletedCount = 0;

        if (newMessages.size > 0) {
            const deleted = await channel.bulkDelete(newMessages, true);
            deletedCount = deleted.size;
        }

        let replyMessage = `✅ Successfully deleted **${deletedCount}** messages.`;
        if (oldMessages.size > 0) {
            replyMessage += `\n⚠️ **${oldMessages.size}** messages were older than 14 days and could not be bulk deleted.`;
        }

        await interaction.editReply({ content: replyMessage, ephemeral: true });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while purging messages." });
    }
}