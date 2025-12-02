import { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ModalBuilder, 
    TextInputBuilder, 
    TextInputStyle, 
    PermissionFlagsBits 
} from "discord.js";
import config from "../config.json" with { type: "json" }; //
import { logError } from "./errorLogger.js"; //

// --- [BARU] Fungsi ini diekspor agar bisa dipakai di mana-mana ---
export function generateControlPanelEmbed() {
    const embed = new EmbedBuilder()
        .setColor(config.embedColor || "#1B1464")
        .setTitle("Change your voice channel settings here.")
        .setDescription("While you are **inside your temporary voice channel**, use the buttons below to manage it.")
        .setImage("https://cdn.discordapp.com/attachments/1435964396408148088/1436712000800428072/temp_voice.png?ex=691099d1&is=690f4851&hm=fd071c2343e1d367ad1ca818ec8ee11c0659a101e2859bbafd0ba782c129c145&"); // <-- GANTI GAMBARMU JIKA PERLU

    // Row 1
    const row1 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId("tv_add_user").setLabel("Add user").setStyle(ButtonStyle.Success).setEmoji("➕"),
            new ButtonBuilder().setCustomId("tv_remove_user").setLabel("Remove user").setStyle(ButtonStyle.Danger).setEmoji("➖"),
            new ButtonBuilder().setCustomId("tv_list_users").setLabel("List users").setStyle(ButtonStyle.Primary).setEmoji("📋")
        );

    // Row 2
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder().setCustomId("tv_public").setLabel("Public").setStyle(ButtonStyle.Success).setEmoji("🔓"),
            new ButtonBuilder().setCustomId("tv_private").setLabel("Private").setStyle(ButtonStyle.Danger).setEmoji("🔒"),
            new ButtonBuilder().setCustomId("tv_edit_channel").setLabel("Edit channel").setStyle(ButtonStyle.Secondary).setEmoji("📝")
        );

    return { embeds: [embed], components: [row1, row2] };
}
// --- [AKHIR FUNGSI BARU] ---


/**
 * Pengecekan apakah user adalah pemilik channel DARI MANA SAJA
 * @param {import('discord.js').Interaction} interaction
 * @returns {Promise<import('discord.js').VoiceChannel | null>}
 */
async function getOwnedChannel(interaction) {
    const member = interaction.member;
    const channel = member.voice.channel; // <-- Mengambil channel suara user

    // 1. Cek apakah user ada di VC
    if (!channel) {
        await interaction.reply({ content: "❌ You must be in your temporary voice channel to use this command.", ephemeral: true });
        return null;
    }

    // 2. Cek apakah VC ada di kategori temp voice
    if (channel.parentId !== config.tempVoiceCategoryId || channel.id === config.tempVoiceCreateChannelId) {
        await interaction.reply({ content: "❌ This command can only be used in a temporary voice channel.", ephemeral: true });
        return null;
    }

    // 3. Cek apakah user adalah "pemilik"
    const perms = channel.permissionsFor(member);
    if (!perms.has(PermissionFlagsBits.ManageChannels)) {
        await interaction.reply({ content: "❌ You are not the owner of this channel.", ephemeral: true });
        return null;
    }

    return channel; // Sukses, kembalikan channel
}

/**
 * Handler utama untuk semua interaksi temp voice (tombol dan modal)
 * @param {import('discord.js').Interaction} interaction
 */
export async function handleTempVoiceInteraction(interaction) {
    const commandName = `tempvoice:${interaction.customId}`;

    // --- [DIHAPUS] Pengecekan interaction.channelId dihapus ---
    // (Sekarang tombol berfungsi dari channel teks ATAU channel suara)

    try {
        // --- A. Handle Modals ---
        if (interaction.isModalSubmit()) {
            const channel = await getOwnedChannel(interaction);
            if (!channel) return; 

            if (interaction.customId === "tv_modal_edit") {
                const newName = interaction.fields.getTextInputValue("tv_edit_name");
                const newLimit = parseInt(interaction.fields.getTextInputValue("tv_edit_limit")) || 0;

                await channel.edit({
                    name: newName,
                    userLimit: newLimit > 99 ? 99 : newLimit
                });
                return interaction.reply({ content: `✅ Your channel has been updated!\nName: **${newName}**\nLimit: **${newLimit === 0 ? 'Unlimited' : newLimit}**`, ephemeral: true });
            }

            if (interaction.customId === "tv_modal_add_user") {
                const userId = interaction.fields.getTextInputValue("tv_user_id");
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (!member) return interaction.reply({ content: "❌ User ID not found in this server.", ephemeral: true });

                await channel.permissionOverwrites.edit(member.id, {
                    Connect: true,
                    ViewChannel: true
                });
                return interaction.reply({ content: `✅ Added **${member.user.tag}** to your channel.`, ephemeral: true });
            }

            if (interaction.customId === "tv_modal_remove_user") {
                const userId = interaction.fields.getTextInputValue("tv_user_id");
                const member = await interaction.guild.members.fetch(userId).catch(() => null);
                if (!member) return interaction.reply({ content: "❌ User ID not found in this server.", ephemeral: true });

                await channel.permissionOverwrites.edit(member.id, {
                    Connect: null,
                    ViewChannel: null
                });

                if (member.voice.channelId === channel.id) {
                    await member.voice.disconnect("Removed from channel by owner.");
                }
                return interaction.reply({ content: `✅ Removed **${member.user.tag}**'s special access.`, ephemeral: true });
            }
        }


        // --- B. Handle Buttons ---
        if (interaction.isButton()) {

            if (interaction.customId === 'tv_list_users') {
                const channel = interaction.member.voice.channel;
                if (!channel || channel.parentId !== config.tempVoiceCategoryId) {
                     return interaction.reply({ content: "❌ You must be in a temp voice channel to list its members.", ephemeral: true });
                }

                const members = channel.members;
                if (members.size === 0) return interaction.reply({ content: "ℹ️ No one is in this channel.", ephemeral: true });

                const list = members.map(m => `• ${m.user.tag}`).join("\n");
                const embed = new EmbedBuilder().setTitle(`Users in ${channel.name}`).setDescription(list).setColor(config.embedColor);
                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            const channel = await getOwnedChannel(interaction);
            if (!channel) return; 

            const everyoneRole = interaction.guild.roles.everyone;

            switch (interaction.customId) {
                case "tv_public":
                    await channel.permissionOverwrites.edit(everyoneRole, { Connect: true });
                    await interaction.reply({ content: "🔓 Your channel is now **Public**.", ephemeral: true });
                    break;

                case "tv_private":
                    await channel.permissionOverwrites.edit(everyoneRole, { Connect: false });
                    await interaction.reply({ content: "🔒 Your channel is now **Private**.", ephemeral: true });
                    break;

                case "tv_edit_channel":
                    const modalEdit = new ModalBuilder().setCustomId("tv_modal_edit").setTitle("Edit Channel");
                    const nameInput = new TextInputBuilder().setCustomId("tv_edit_name").setLabel("Channel Name").setStyle(TextInputStyle.Short).setValue(channel.name).setRequired(true);
                    const limitInput = new TextInputBuilder().setCustomId("tv_edit_limit").setLabel("User Limit (0 = Unlimited)").setStyle(TextInputStyle.Short).setValue(String(channel.userLimit)).setRequired(true);
                    modalEdit.addComponents(new ActionRowBuilder().addComponents(nameInput), new ActionRowBuilder().addComponents(limitInput));
                    await interaction.showModal(modalEdit);
                    break;

                case "tv_add_user":
                    const modalAdd = new ModalBuilder().setCustomId("tv_modal_add_user").setTitle("Add User to Channel");
                    const addInput = new TextInputBuilder().setCustomId("tv_user_id").setLabel("User ID to Add").setStyle(TextInputStyle.Short).setPlaceholder("Paste the user's Discord ID here.").setRequired(true);
                    modalAdd.addComponents(new ActionRowBuilder().addComponents(addInput));
                    await interaction.showModal(modalAdd);
                    break;

                case "tv_remove_user":
                    const modalRemove = new ModalBuilder().setCustomId("tv_modal_remove_user").setTitle("Remove User from Channel");
                    const removeInput = new TextInputBuilder().setCustomId("tv_user_id").setLabel("User ID to Remove/Kick").setStyle(TextInputStyle.Short).setPlaceholder("Paste the user's Discord ID here.").setRequired(true);
                    modalRemove.addComponents(new ActionRowBuilder().addComponents(removeInput));
                    await interaction.showModal(modalRemove);
                    break;
            }
        }

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred." });
        } else if (!interaction.replied) {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}