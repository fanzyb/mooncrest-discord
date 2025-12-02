import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getAllUsers } from "../db/firestore.js";
import { embedColor } from "../utils/helpers.js";
import { logError } from "../utils/errorLogger.js";
import config from "../config.json" with { type: "json" };

export const data = new SlashCommandBuilder()
    .setName("listverify")
    .setDescription("Menampilkan daftar semua pengguna yang telah terverifikasi.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator); // Hanya admin

export async function execute(interaction) {
    const commandName = "listverify";
    try {
        // Cek izin tambahan (opsional, meniru /debug dan /stats)
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.debugManagerRoles || []).includes(r.id));
            
        if (!allowed) {
            return interaction.reply({ content: "❌ Anda tidak memiliki izin untuk menggunakan perintah ini.", ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true }); // Daftar ini sebaiknya hanya bisa dilihat oleh admin

        const allUsers = await getAllUsers();
        
        // Filter hanya yang terverifikasi DAN punya discordId
        const verifiedUsers = allUsers.filter(u => u.isVerified && u.discordId);

        if (verifiedUsers.length === 0) {
            return interaction.editReply({ content: "ℹ️ Tidak ada pengguna terverifikasi yang ditemukan di database." });
        }

        // Urutkan berdasarkan nama Roblox untuk kerapian
        verifiedUsers.sort((a, b) => a.robloxUsername.localeCompare(b.robloxUsername));

        // Buat daftar deskripsi
        let description = verifiedUsers
            .map(u => `• <@${u.discordId}> - \`${u.robloxUsername}\``)
            .join("\n");

        // Antisipasi jika daftar terlalu panjang (batas deskripsi embed adalah 4096 karakter)
        if (description.length > 4096) {
            description = description.substring(0, 4090) + "\n... (dan seterusnya)";
            // Catatan: Untuk daftar yang sangat besar, idealnya menggunakan paginasi seperti /leaderboard
        }

        const embed = new EmbedBuilder()
            .setTitle(`Daftar Pengguna Terverifikasi (${verifiedUsers.length})`)
            .setColor(embedColor)
            .setDescription(description)
            .setTimestamp()
            .setFooter({ text: "Daftar ini hanya terlihat oleh Anda." });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ Terjadi kesalahan saat mengambil daftar pengguna." });
        } else {
            await interaction.reply({ content: "❌ Terjadi kesalahan saat mengambil daftar pengguna.", ephemeral: true });
        }
    }
}