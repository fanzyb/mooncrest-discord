import { 
    SlashCommandBuilder, 
    PermissionFlagsBits, 
    EmbedBuilder, 
    ModalBuilder, 
    TextInputBuilder, 
    ActionRowBuilder, 
    TextInputStyle 
} from "discord.js";
import { logError } from "../utils/errorLogger.js";
import config from "../config.json" with { type: "json" };

export const data = new SlashCommandBuilder()
    .setName("message")
    .setDescription("Send a DM to multiple users or roles (Admin only).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(opt =>
        opt.setName("targets")
            .setDescription("Optional: Pre-fill targets (e.g., @user1, @role1, 123456789)")
            .setRequired(false)
    );

export async function execute(interaction) {
    const commandName = "message";
    try {
        // Hanya admin
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: "❌ You must be an administrator to use this command.", ephemeral: true });
        }

        const prefilledTargets = interaction.options.getString("targets") || "";

        const modal = new ModalBuilder()
            .setCustomId('send_message_modal')
            .setTitle('Send Bulk Message (DM)');

        const targetsInput = new TextInputBuilder()
            .setCustomId('targets_input')
            .setLabel("Targets (Users/Roles, comma separated)")
            .setPlaceholder("e.g., @User, @Role, 123456789012345678")
            .setStyle(TextInputStyle.Short)
            .setValue(prefilledTargets)
            .setRequired(true);
            
        const messageInput = new TextInputBuilder()
            .setCustomId('message_content')
            .setLabel("Message Content")
            .setPlaceholder("This message will be sent as a DM...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(targetsInput),
            new ActionRowBuilder().addComponents(messageInput)
        );

        await interaction.showModal(modal);

    } catch (error) {
        logError(error, interaction, commandName);
    }
}

// Fungsi ini akan dipanggil dari index.js saat modal disubmit
export async function handleModalSubmit(interaction) {
    const commandName = "message:modal";
    try {
        if (interaction.customId !== 'send_message_modal') return;

        await interaction.deferReply({ ephemeral: true });

        const targetsString = interaction.fields.getTextInputValue('targets_input');
        const messageContent = interaction.fields.getTextInputValue('message_content');

        const userMentionRegex = /<@!?(\d+)>/g;
        const roleMentionRegex = /<@&(\d+)>/g;
        const idRegex = /\d{17,19}/g; // Ambil semua ID

        const userIds = new Set();
        const roleIds = new Set();

        // 1. Ambil dari mention user
        for (const match of targetsString.matchAll(userMentionRegex)) {
            userIds.add(match[1]);
        }

        // 2. Ambil dari mention role
        for (const match of targetsString.matchAll(roleMentionRegex)) {
            roleIds.add(match[1]);
        }
        
        // 3. Ambil ID mentah
        for (const match of targetsString.matchAll(idRegex)) {
            const id = match[0];
            // Cek apakah ID ini sudah terdaftar (dari mention)
            if (userIds.has(id) || roleIds.has(id)) continue;

            // Jika belum, cek apakah ini role atau user
            if (interaction.guild.roles.cache.has(id)) {
                roleIds.add(id);
            } else {
                // Asumsikan user jika bukan role
                userIds.add(id);
            }
        }
        
        if (userIds.size === 0 && roleIds.size === 0) {
            return interaction.editReply({ content: "⚠️ No valid user or role targets were found. Please provide mentions or IDs." });
        }

        // Kumpulkan semua member unik
        const membersToSend = new Map();

        // Tambah user dari ID
        for (const userId of userIds) {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            if (member) membersToSend.set(member.id, member);
        }

        // Tambah user dari role
        for (const roleId of roleIds) {
            const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
            if (role) {
                role.members.forEach(member => membersToSend.set(member.id, member));
            }
        }
        
        if (membersToSend.size === 0) {
             return interaction.editReply({ content: "⚠️ No valid members found from the provided targets." });
        }

        // Buat embed pesannya
        const embed = new EmbedBuilder()
            .setTitle(`Message from ${interaction.guild.name}`)
            .setDescription(messageContent)
            .setColor(config.embedColor || "#1B1464")
            .setFooter({ text: `Sent by: ${interaction.user.tag}` })
            .setTimestamp();

        let successCount = 0;
        let failCount = 0;
        
        for (const member of membersToSend.values()) {
            await member.send({ embeds: [embed] })
                .then(() => successCount++)
                .catch(() => failCount++);
        }
        
        await interaction.editReply({ 
            content: `✅ Message sending complete!\n\nSuccessfully sent to **${successCount}** members.\nFailed to send to **${failCount}** members (DMs may be closed or they are bots).` 
        });

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while processing the message." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}