import { EmbedBuilder } from "discord.js";
import config from "../config.json" with { type: "json" };

/**
 * Mengirim log moderasi ke channel log.
 * @param {import('discord.js').Guild} guild - Server (guild).
 * @param {string} title - Judul embed (mis. "User Banned").
 * @param {string} color - Warna hex (mis. "#FF0000").
 * @param {import('discord.js').User} target - User yang ditindak.
 * @param {import('discord.js').User} moderator - Moderator yang menindak.
 * @param {string} reason - Alasan tindakan.
 * @param {object} extraFields - Field tambahan (opsional).
 */
export async function sendModLog(guild, title, color, target, moderator, reason, extraFields = []) {
    try {
        const channelId = config.modLogChannelId;
        if (!channelId) return; // Tidak ada channel, tidak kirim log

        const logChannel = guild.channels.cache.get(channelId);
        if (!logChannel) {
            console.warn(`[ModLog] Channel ID ${channelId} not found.`);
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setTimestamp()
            .addFields(
                { name: "Target", value: `${target.tag} (${target.id})`, inline: false },
                { name: "Moderator", value: `${moderator.tag} (${moderator.id})`, inline: false },
                { name: "Reason", value: reason || "No reason provided.", inline: false }
            )
            .setThumbnail(target.displayAvatarURL());

        if (extraFields.length > 0) {
            embed.addFields(extraFields);
        }

        await logChannel.send({ embeds: [embed] });

    } catch (err) {
        console.error("Failed to send mod log:", err);
    }
}