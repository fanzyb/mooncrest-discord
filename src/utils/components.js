import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { findUserByDiscordId, saveUser, countTotalUsers, findLeaderboardUsers } from "../db/firestore.js";
import { achievementsConfig, embedColor } from "./helpers.js"; // getRobloxUser tidak lagi wajib di sini
import config from "../config.json" with { type: "json" };

// --- Reward Select Menu Handler ---
export async function handleRewardSelectMenu(interaction) {
    // Format customId sekarang: "reward_add:DISCORD_ID" atau "reward_remove:DISCORD_ID"
    const [action, targetDiscordId] = interaction.customId.split(":");
    const selectedId = parseInt(interaction.values[0]);
    
    const achv = achievementsConfig.find(a => a.id === selectedId);
    if (!achv) return interaction.update({ content: "⚠️ Achievement not found in config.", components: [] });

    // Cari data user di database menggunakan Discord ID
    let user = await findUserByDiscordId(targetDiscordId);
    if (!user) return interaction.update({ content: "⚠️ User data not found (User might have unlinked).", components: [] });

    // Ambil Member Discord untuk manajemen Role
    const guild = interaction.guild;
    const member = await guild.members.fetch(targetDiscordId).catch(() => null);
    if (!member) return interaction.update({ content: "⚠️ Member not found in this server.", components: [] });

    const rewardLogChannel = guild.channels.cache.get(config.rewardLogChannelId);

    let roleUpdateMsg = "";

    // --- LOGIKA ADD ---
    if (action === "reward_add") {
        if (!user.achievements.includes(selectedId)) {
            user.achievements.push(selectedId);
        }
        await saveUser(user);

        // Tambah Role jika ada di config
        if (achv.roleId) {
            try {
                const role = guild.roles.cache.get(achv.roleId);
                if (role) {
                    await member.roles.add(role);
                    roleUpdateMsg = ` and role **${role.name}** given`;
                } else {
                    roleUpdateMsg = ` but configured role ID not found`;
                }
            } catch (err) {
                console.error("Failed to add achievement role:", err);
                roleUpdateMsg = ` but failed to give role (Check permissions)`;
            }
        }

        // Kirim Log
        if (rewardLogChannel) {
            const embed = new EmbedBuilder()
                .setTitle("🎖️ Achievement Added")
                .setColor("#00FF00")
                .addFields(
                    { name: "User", value: `<@${member.id}> (${user.robloxUsername})`, inline: true },
                    { name: "Achievement", value: achv.name, inline: true },
                    { name: "Role Update", value: roleUpdateMsg || "No role linked", inline: false },
                    { name: "Admin", value: interaction.user.tag, inline: true }
                ).setTimestamp();
            rewardLogChannel.send({ embeds: [embed] }).catch(() => {});
        }

        return interaction.update({ content: `✅ Added **${achv.name}** to <@${member.id}>${roleUpdateMsg}.`, components: [] });
    }

    // --- LOGIKA REMOVE ---
    if (action === "reward_remove") {
        user.achievements = user.achievements.filter(a => a !== selectedId);
        await saveUser(user);

        // Hapus Role jika ada di config
        if (achv.roleId) {
            try {
                const role = guild.roles.cache.get(achv.roleId);
                if (role && member.roles.cache.has(role.id)) {
                    await member.roles.remove(role);
                    roleUpdateMsg = ` and role **${role.name}** removed`;
                }
            } catch (err) {
                console.error("Failed to remove achievement role:", err);
                roleUpdateMsg = ` but failed to remove role`;
            }
        }

        // Kirim Log
        if (rewardLogChannel) {
            const embed = new EmbedBuilder()
                .setTitle("🗑 Achievement Removed")
                .setColor("#FF0000")
                .addFields(
                    { name: "User", value: `<@${member.id}> (${user.robloxUsername})`, inline: true },
                    { name: "Achievement", value: achv.name, inline: true },
                    { name: "Role Update", value: roleUpdateMsg || "No role linked", inline: false },
                    { name: "Admin", value: interaction.user.tag, inline: true }
                ).setTimestamp();
            rewardLogChannel.send({ embeds: [embed] }).catch(() => {});
        }

        return interaction.update({ content: `🗑 Removed **${achv.name}** from <@${member.id}>${roleUpdateMsg}.`, components: [] });
    }

    return interaction.update({ content: "⚠️ Unknown action.", components: [] });
}

// --- (Sisa file components.js tetap sama: generateLeaderboardEmbed, handleLeaderboardButton, dll) ---
// Pastikan kode leaderboard di bawah ini tetap ada di file components.js kamu.

export async function generateLeaderboardEmbed(pageNum, lbType, limit = 10) {
    const sortField = lbType === 'expo' ? 'expeditions' : 'xp'; 
    const sortTitle = lbType === 'expo' ? 'Expedition' : '🌙 Lunar Points'; 

    const totalUsers = await countTotalUsers();
    const totalPages = Math.max(1, Math.ceil(totalUsers / limit));

    if (pageNum < 1) pageNum = 1;
    if (pageNum > totalPages) pageNum = totalPages;

    const users = await findLeaderboardUsers(sortField, limit, (pageNum - 1) * limit);

    let desc = "";
    let rank = (pageNum - 1) * limit + 1;
    for (const u of users) {
        const value = u[sortField] || 0;
        desc += `**#${rank}** - **${u.robloxUsername}** → ${value} ${sortTitle}\n`;
        rank++;
    }

    const buttonRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`lb_prev_${lbType}_${pageNum}`).setLabel("⬅️ Prev").setStyle(ButtonStyle.Primary).setDisabled(pageNum === 1),
        new ButtonBuilder().setCustomId(`lb_next_${lbType}_${pageNum}`).setLabel("Next ➡️").setStyle(ButtonStyle.Primary).setDisabled(pageNum === totalPages)
    );

    const switchRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`lb_switch_${lbType === 'xp' ? 'expo' : 'xp'}_1`).setLabel(`Switch to ${lbType === 'xp' ? 'Expedition' : '🌙 Lunar Points'} LB`).setStyle(ButtonStyle.Secondary)
    );

    return {
        embeds: [
            new EmbedBuilder()
                .setTitle(`🏆 Leaderboard ${sortTitle} (Page ${pageNum}/${totalPages})`)
                .setColor(embedColor)
                .setDescription(desc || "⚠️ Tidak ada pengguna ditemukan.")
        ],
        components: [buttonRow, switchRow],
    };
}

export async function handleLeaderboardButton(interaction) {
    if (interaction.replied || interaction.deferred) return;
    try {
        const parts = interaction.customId.split("_");
        const btnAction = parts[1];
        const btnType = parts[2]; 
        let currentPage = parseInt(parts[3]) || 1;

        let newType = btnType;
        let newPage = currentPage;

        if (btnAction === 'switch') {
            newType = btnType;
            newPage = 1; 
        } else {
            newType = btnType;
            newPage = btnAction === 'prev' ? currentPage - 1 : currentPage + 1;
        }

        await interaction.deferUpdate();
        const result = await generateLeaderboardEmbed(newPage, newType);
        await interaction.editReply(result);

    } catch (error) {
        console.error("Error menangani tombol leaderboard:", error);
    }
}

export async function handleComponentInteraction(interaction) {
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith("reward_")) {
        return handleRewardSelectMenu(interaction);
    }
    if (interaction.isButton() && interaction.customId.startsWith("lb_")) {
        return handleLeaderboardButton(interaction);
    }
}