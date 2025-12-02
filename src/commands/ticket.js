import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    EmbedBuilder,
    ChannelType,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    PermissionsBitField
} from "discord.js";
import { createTranscript } from "discord-html-transcripts";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

// --- SLASH COMMAND DATA ---
// (Tidak ada perubahan di sini)
export const data = new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Manage the ticket system.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("setup")
            .setDescription("Post the ticket creation panel in a channel.")
            .addChannelOption(opt =>
                opt.setName("channel")
                    .setDescription("The channel to post the panel in.")
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName("close")
            .setDescription("Close the current ticket channel (Support Staff only).")
    )
    .addSubcommand(sub =>
        sub.setName("add")
            .setDescription("Add a user to this ticket (Support Staff only).")
            .addUserOption(opt => opt.setName("member").setDescription("The member to add").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("remove")
            .setDescription("Remove a user from this ticket (Support Staff only).")
            .addUserOption(opt => opt.setName("member").setDescription("The member to remove").setRequired(true))
    );

// --- SLASH COMMAND EXECUTION ---
// (Tidak ada perubahan di sini)
export async function execute(interaction) {
    const commandName = `ticket ${interaction.options.getSubcommand()}`;
    try {
        const sub = interaction.options.getSubcommand();
        const supportRoleId = config.ticketSupportRoleId;
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (sub !== "setup" && !isAdmin) {
            if (!supportRoleId || !interaction.member.roles.cache.has(supportRoleId)) {
                return interaction.reply({ content: "❌ You must be an Administrator or have the Ticket Support role to use this command.", ephemeral: true });
            }
        }

        if (sub === "setup") {
            const channel = interaction.options.getChannel("channel");
            const panel = generateTicketPanel();
            await channel.send(panel);
            return interaction.reply({ content: `✅ Ticket panel successfully posted in ${channel}.`, ephemeral: true });
        }

        const categoryId = config.ticketCategoryId;
        if (!interaction.channel.parentId || interaction.channel.parentId !== categoryId) {
            return interaction.reply({ content: "❌ This command can only be used inside an active ticket channel.", ephemeral: true });
        }

        if (sub === "close") {
            // --- [PERUBAHAN] Perintah /ticket close sekarang juga memicu konfirmasi ---
            await sendConfirmationMessage(interaction);
        }

        if (sub === "add") {
            const member = interaction.options.getMember("member");
            await interaction.channel.permissionOverwrites.edit(member.id, {
                ViewChannel: true,
                SendMessages: true,
                ReadMessageHistory: true
            });
            return interaction.reply({ content: `✅ Added ${member} to this ticket.`, ephemeral: false });
        }

        if (sub === "remove") {
            const member = interaction.options.getMember("member");
            await interaction.channel.permissionOverwrites.edit(member.id, {
                ViewChannel: false
            });
            return interaction.reply({ content: `✅ Removed ${member} from this ticket.`, ephemeral: false });
        }

    } catch (error) {
        logError(error, interaction, commandName);
    }
}

// --- FUNGSI BARU UNTUK MENGIRIM KONFIRMASI ---
async function sendConfirmationMessage(interaction) {
    const confirmButton = new ButtonBuilder()
        .setCustomId('ticket_close_confirm')
        .setLabel('Confirm Close')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('✔️');

    const cancelButton = new ButtonBuilder()
        .setCustomId('ticket_close_cancel')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('✖️');

    const row = new ActionRowBuilder().addComponents(confirmButton, cancelButton);

    await interaction.reply({
        content: 'Are you sure you want to close this ticket?',
        components: [row],
        ephemeral: true // Pesan konfirmasi hanya terlihat oleh pengguna
    });
}

// --- TICKET PANEL ---
// (Tidak ada perubahan di sini)
function generateTicketPanel() {
    const embed = new EmbedBuilder()
        .setTitle("Support Ticket Panel")
        .setDescription(
            "You may open a support ticket for the following reasons:\n" +
            "1. General inquiries or questions.\n" +
            "2. Issues related to rankings.\n" +
            "3. Reporting a user for misconduct.\n" +
            "4. Claiming perks associated with a donation.\n" +
            "5. Redeeming a prize won through an event."
        )
        .setColor(config.embedColor || "#1B1464")
        .setImage("https://cdn.discordapp.com/attachments/1435964396408148088/1435964469741355029/VERIFY.png?ex=690de1a0&is=690c9020&hm=5555862102d54db8d7d67b428e0f7c14d99161a2608fa1dc50035bc847c21066&") // <-- Jangan lupa ganti ini jika perlu
        .setFooter({ text: "Please click the button below to open a ticket." });

    const button = new ButtonBuilder()
        .setCustomId("ticket_create_modal") 
        .setLabel("Create Ticket")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("🎟️");

    const row = new ActionRowBuilder().addComponents(button);
    return { embeds: [embed], components: [row] };
}

// --- TICKET CLOSE LOGIC ---
// (Tidak ada perubahan di sini)
async function closeTicket(interaction, closer) {
    const channel = interaction.channel;
    const commandName = "ticket:close";
    try {
        const attachment = await createTranscript(channel, {
            limit: -1,
            returnType: 'attachment',
            fileName: `transcript-${channel.name}.html`,
            saveImages: true,
            poweredBy: false
        });

        const logChannelId = config.ticketTranscriptLogId || config.transcriptLogChannelId;
        if (logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const ticketOwnerId = channel.name.split('-')[1]; 
                const ticketOwner = await interaction.guild.members.fetch(ticketOwnerId).catch(() => null);

                const logEmbed = new EmbedBuilder()
                    .setTitle("📝 Ticket Closed & Transcript Saved")
                    .setColor("#FFD700")
                    .addFields(
                        { name: "Ticket", value: channel.name, inline: true },
                        { name: "Closed By", value: closer.tag, inline: true },
                        { name: "Ticket Owner", value: ticketOwner ? ticketOwner.user.tag : `ID: ${ticketOwnerId}`, inline: true }
                    )
                    .setTimestamp();

                await logChannel.send({ embeds: [logEmbed], files: [attachment] });
            }
        }
        await channel.delete();

    } catch (error) {
        logError(error, interaction, commandName);
        // Kita tidak bisa membalas interaksi di sini karena mungkin sudah ditutup
        // Cukup log error-nya saja.
    }
}


// --- BUTTON HANDLER (DIPERBARUI) ---
export async function handleTicketButton(interaction) {
    const customId = interaction.customId;
    const commandName = "ticket:button";

    try {
        // Menangani klik tombol "Create Ticket"
        if (customId === "ticket_create_modal") {
            const modal = new ModalBuilder()
                .setCustomId('ticket_create_submit') 
                .setTitle('Create a New Ticket');

            const reasonInput = new TextInputBuilder()
                .setCustomId('ticket_reason')
                .setLabel("What is the reason for this ticket?")
                .setPlaceholder("Please describe your issue in detail.")
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
            await interaction.showModal(modal);
        }

        // --- [PERUBAHAN] Tombol close utama sekarang memanggil konfirmasi ---
        if (customId === "ticket_close_request") {
            await sendConfirmationMessage(interaction);
        }

        // Tombol ini HANYA ditekan dari pesan konfirmasi ephemeral
        if (customId === "ticket_close_confirm") {
            // Edit pesan konfirmasi (ephemeral)
            await interaction.update({ content: "🔒 This ticket is now closing...", components: [] });
            // Panggil fungsi close (interaksi aslinya adalah tombol konfirmasi)
            await closeTicket(interaction, interaction.user);
        }

        // --- [BARU] Menangani tombol "Cancel" ---
        if (customId === "ticket_close_cancel") {
            // Hapus pesan konfirmasi ephemeral
            await interaction.message.delete();
        }

    } catch (error) {
        logError(error, interaction, commandName);
    }
}

// --- MODAL SUBMIT HANDLER (DIPERBARUI) ---
export async function handleTicketModal(interaction) {
    const customId = interaction.customId;
    const commandName = "ticket:modal";

    try {
        if (customId === 'ticket_create_submit') {
            const categoryId = config.ticketCategoryId;
            const supportRoleId = config.ticketSupportRoleId;

            if (!categoryId || !supportRoleId) {
                return interaction.reply({ content: "❌ Ticket system is not configured correctly. Please contact an admin.", ephemeral: true });
            }

            const channelName = `ticket-${interaction.user.username}`; 
            const existingChannel = interaction.guild.channels.cache.find(c => 
                c.name === channelName && 
                c.parentId === categoryId 
            );

            if (existingChannel) {
                return interaction.reply({
                    content: `❌ You already have an open ticket. Please use your existing ticket: ${existingChannel}`,
                    ephemeral: true
                });
            }

            const reason = interaction.fields.getTextInputValue('ticket_reason');
            await interaction.deferReply({ ephemeral: true });

            const permissionOverwrites = [
                {
                    id: interaction.guild.roles.everyone,
                    deny: [PermissionsBitField.Flags.ViewChannel],
                },
                {
                    id: interaction.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles],
                },
                {
                    id: supportRoleId,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles],
                },
                {
                    id: interaction.client.user.id,
                    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.ManageChannels],
                }
            ];

            const channel = await interaction.guild.channels.create({
                name: channelName,
                type: ChannelType.GuildText,
                parent: categoryId,
                permissionOverwrites: permissionOverwrites,
            });

            const welcomeEmbed = new EmbedBuilder()
                .setTitle(`Welcome to your ticket, ${interaction.user.username}!`)
                .setDescription("Our support team will be with you shortly.\n\nPlease provide any relevant details, screenshots, or usernames related to your issue.")
                .addFields({ name: "Your Reason", value: reason })
                .setColor(config.embedColor || "#1B1464")
                .setTimestamp();

            // --- [PERUBAHAN] Tombol close di dalam tiket sekarang punya ID 'ticket_close_request' ---
            const closeButton = new ButtonBuilder()
                .setCustomId("ticket_close_request") // <-- ID DIUBAH
                .setLabel("Close Ticket")
                .setStyle(ButtonStyle.Danger)
                .setEmoji("🔒");

            const row = new ActionRowBuilder().addComponents(closeButton);

            await channel.send({ 
                content: `👋 <@${interaction.user.id}>, your ticket has been created. <@&${supportRoleId}> will be notified.`,
                embeds: [welcomeEmbed],
                components: [row]
            });

            await interaction.editReply({ content: `✅ Your ticket has been created! Please go to ${channel} to continue.` });
        }
    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while creating your ticket." });
        }
    }
}