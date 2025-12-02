import { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder, EmbedBuilder } from "discord.js";
import { createTranscript } from "discord-html-transcripts";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("transcript")
    .setDescription("Saves a transcript of the current channel as an HTML file.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Hanya admin yang bisa pakai
    .addStringOption(option =>
        option.setName("filename")
            .setDescription("Optional name for the transcript file.")
            .setRequired(false)
    );

export async function execute(interaction) {
    const commandName = "transcript";
    try {
        await interaction.deferReply({ ephemeral: true }); // Balasan awal hanya terlihat oleh admin

        const channelToTranscript = interaction.channel;
        const fileName = interaction.options.getString("filename") || `transcript-${channelToTranscript.name}.html`;

        // Membuat transkrip menggunakan library
        const attachment = await createTranscript(channelToTranscript, {
            limit: -1, // -1 berarti mengambil semua pesan
            returnType: 'attachment', // Mengembalikan sebagai file attachment
            fileName: fileName,
            saveImages: true, // Menyimpan gambar yang dikirim di chat
            poweredBy: false // Menghilangkan watermark "Powered by"
        });

        // 1. Kirim file transkrip ke channel log
        const logChannelId = config.transcriptLogChannelId;
        if (logChannelId) {
            const logChannel = interaction.guild.channels.cache.get(logChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle("📝 Channel Transcript Saved")
                    .setColor("#4A90E2") // Biru
                    .setDescription(`A transcript was saved from channel <#${channelToTranscript.id}>.`)
                    .addFields(
                        { name: "Saved By", value: interaction.user.tag, inline: true },
                        { name: "Channel", value: channelToTranscript.name, inline: true },
                        { name: "Filename", value: fileName, inline: true }
                    )
                    .setTimestamp();

                try {
                    await logChannel.send({ embeds: [logEmbed], files: [attachment] });
                } catch (logErr) {
                    console.error("Failed to send transcript to log channel:", logErr);
                    // Jika gagal kirim ke log, kirim ke channel saat ini sebagai cadangan
                    await interaction.channel.send({
                        content: `⚠️ **Log Channel Error!** Here is the transcript file instead:`,
                        files: [attachment]
                    });
                }
            } else {
                console.warn(`[WARN] Transcript log channel with ID ${logChannelId} not found.`);
                 await interaction.channel.send({
                    content: `⚠️ **Configuration Error!** Transcript log channel not found. Here is the file:`,
                    files: [attachment]
                });
            }
        } else {
             // Jika tidak ada log channel, kirim langsung ke channel saat ini
             await interaction.channel.send({
                content: `Here is the transcript for this channel:`,
                files: [attachment]
            });
        }

        // 2. Beri konfirmasi kepada admin
        await interaction.editReply({ content: `✅ Transcript has been successfully saved to the log channel.` });

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while creating the transcript." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}