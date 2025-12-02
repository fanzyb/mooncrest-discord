import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getAllUsers } from "../db/firestore.js";
import { embedColor, getLevel } from "../utils/helpers.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show community statistics dashboard (Admin/Debug role only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    const commandName = "stats";
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.debugManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", flags: 64 });

        await interaction.deferReply({ flags: 64 });

        const allUsers = await getAllUsers();
        if (allUsers.length === 0) {
            return interaction.editReply({ content: "⚠️ No users found in the database yet." });
        }

        const totalUsers = allUsers.length;
        const totalVerified = allUsers.filter(u => u.isVerified && u.discordId).length;
        const totalXP = allUsers.reduce((acc, user) => acc + (user.xp || 0), 0);
        const totalExpeditions = allUsers.reduce((acc, user) => acc + (user.expeditions || 0), 0);

        const sortedByXP = [...allUsers].sort((a, b) => (b.xp || 0) - (a.xp || 0));
        const sortedByExpo = [...allUsers].sort((a, b) => (b.expeditions || 0) - (a.expeditions || 0));

        const topXPUser = sortedByXP[0];
        const topExpoUser = sortedByExpo[0];

        const levelCounts = {};
        for (const user of allUsers) {
            const levelName = getLevel(user.xp).levelName;
            levelCounts[levelName] = (levelCounts[levelName] || 0) + 1;
        }
        const levelDistribution = (config.levels || [])
            .map(level => level.name)
            .filter(levelName => levelCounts[levelName])
            .map(levelName => `**${levelName}**: ${levelCounts[levelName]} users`)
            .join("\n") || "N/A";

        const achvCounts = {};
        for (const user of allUsers) {
            for (const achvId of user.achievements || []) {
                achvCounts[achvId] = (achvCounts[achvId] || 0) + 1;
            }
        }
        const rarestAchvEntry = Object.entries(achvCounts).sort((a, b) => a[1] - b[1])[0];
        let rarestAchvString = "N/A (No achievements given)";
        if (rarestAchvEntry) {
            const achvInfo = config.achievements.find(a => a.id === parseInt(rarestAchvEntry[0]));
            if (achvInfo) {
                rarestAchvString = `**${achvInfo.name}** (${rarestAchvEntry[1]} owners)`;
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`📈 Dasbor Statistik Komunitas`)
            .setColor(embedColor)
            .setDescription(`Ringkasan data dari **${totalUsers}** total pengguna di database.`)
            .addFields(
                { name: "Total Pengguna Terverifikasi", value: `**${totalVerified}** / ${totalUsers} pengguna`, inline: true },
                { name: "Total Lunar Points (Seluruh Komunitas)", value: `**${totalXP.toLocaleString()}** Lunar Points`, inline: true }, // <-- [GANTI]
                { name: "Total Ekspedisi (Seluruh Komunitas)", value: `**${totalExpeditions.toLocaleString()}** ekspedisi`, inline: true },
                { name: "Pengguna Lunar Points Tertinggi", value: `**${topXPUser.robloxUsername}** (${topXPUser.xp} Lunar Points)`, inline: false }, // <-- [GANTI]
                { name: "Pengguna Ekspedisi Terbanyak", value: `**${topExpoUser.robloxUsername}** (${topExpoUser.expeditions} ekspedisi)`, inline: false },
                { name: "Distribusi Level", value: levelDistribution, inline: true },
                { name: "Achievement Terlangka", value: rarestAchvString, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: "Statistik ini bersifat rahasia untuk Admin." });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while generating stats." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", flags: 64 });
        }
    }
}