import { SlashCommandBuilder } from "discord.js";
import { getAfkStatus, saveAfkStatus, deleteAfkStatus } from "../db/firestore.js"; // Pastikan deleteAfkStatus di-import
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("afk")
    .setDescription("Set your AFK (Away From Keyboard) status.")
    .addStringOption(opt =>
        opt.setName("reason")
            .setDescription("Why are you AFK? (Optional)")
            .setRequired(false)
    );

export async function execute(interaction) {
    const commandName = "afk";
    try {
        await interaction.deferReply({ ephemeral: true });

        const reason = interaction.options.getString("reason") || "AFK";
        const userId = interaction.user.id;
        const member = interaction.member;

        const existingAfk = await getAfkStatus(userId);
        if (existingAfk) {
            return interaction.editReply({ content: "ℹ️ You are already set as AFK." });
        }

        // Store the current nickname, or null if they don't have one
        const originalNickname = member.nickname;
        // [FIX] Gunakan member.displayName agar mengambil username jika nickname kosong
        const newNickname = `[AFK] ${member.displayName}`.slice(0, 32); 

        try {
            await member.setNickname(newNickname);
        } catch (e) {
            logError(e, interaction, "afk (set nickname)");
            return interaction.editReply({ content: "❌ I could not change your nickname. This might be because you are the server owner or have a role higher than mine. AFK status was not set." });
        }

        const afkData = {
            userId: userId,
            guildId: interaction.guild.id,
            reason: reason,
            timestamp: Date.now(),
            originalNickname: originalNickname // Ini bisa null, tidak apa-apa
        };

        await saveAfkStatus(userId, afkData);
        
        await interaction.editReply({ content: `✅ Your AFK status has been set: **${reason}**` });

    } catch (error) {
        logError(error, interaction, commandName);
        
        // --- [BLOK PERBAIKAN DI SINI] ---
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        } else {
            // Tambahkan ini untuk menangani error jika deferReply() gagal
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
        // --- [AKHIR PERBAIKAN] ---
    }
}