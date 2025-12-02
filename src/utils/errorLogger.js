import { EmbedBuilder } from "discord.js";
import config from "../config.json" with { type: "json" };

/**
 * Mengirim log error ke channel Discord yang ditentukan.
 * @param {Error} error - Objek error yang ditangkap.
 * @param {import('discord.js').Interaction} interaction - Interaksi yang menyebabkan error.
 * @param {string} commandName - Nama perintah yang sedang dieksekusi.
 */
export async function logError(error, interaction, commandName) {
    console.error(`[ERROR] in command '${commandName}':`, error);

    // Jangan coba mengirim log jika interaksi atau guild tidak valid
    if (!interaction || !interaction.guild) {
        console.error("Interaction or guild is not available for error logging.");
        return;
    }

    const errorLogChannelId = config.errorLogChannelId; // Tambahkan ID channel ini di config.json
    if (!errorLogChannelId) {
        console.warn("`errorLogChannelId` not found in config.json. Skipping Discord log.");
        return;
    }

    const logChannel = interaction.guild.channels.cache.get(errorLogChannelId);
    if (!logChannel) {
        console.warn(`Error log channel with ID '${errorLogChannelId}' not found.`);
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`❌ Command Error: /${commandName}`)
        .setColor("#FF0000") // Merah
        .addFields(
            { name: "User", value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: true },
            { name: "Channel", value: `${interaction.channel}`, inline: true },
            { name: "Timestamp", value: new Date().toUTCString(), inline: false },
            { name: "Error Message", value: `\`\`\`${error.message}\`\`\``, inline: false },
            { name: "Stack Trace", value: `\`\`\`${error.stack ? error.stack.substring(0, 1000) : 'No stack available'}\`\`\``, inline: false }
        )
        .setTimestamp();

    try {
        await logChannel.send({ embeds: [embed] });
    } catch (sendError) {
        console.error("Failed to send error log to Discord:", sendError);
    }
}