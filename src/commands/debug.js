import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { embedColor } from "../utils/helpers.js";
import { countTotalUsers, getAllUsers } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };

export const data = new SlashCommandBuilder()
    .setName("debug")
    .setDescription("Show system debug info (Admin or debug role only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export async function execute(interaction) {
    const allowed =
        interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
        interaction.member.roles.cache.some(r => (config.debugManagerRoles || []).includes(r.id));
    if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", flags: 64 });

    await interaction.deferReply({ flags: 64 });

    const dbState = "🟢 Connected (Firebase)"; 
    const totalUsers = await countTotalUsers();

    const users = await getAllUsers();
    const totalXP = users.reduce((s, u) => s + (u.xp || 0), 0);
    const totalExpeditions = users.reduce((s, u) => s + (u.expeditions || 0), 0);

    const uptime = Math.floor(process.uptime());
    const h = Math.floor(uptime / 3600);
    const m = Math.floor((uptime % 3600) / 60);

    let commandsCount = 0;
    try {
        commandsCount = interaction.client.application?.commands?.cache?.size ?? (await interaction.client.application.commands.fetch()).size;
    } catch {
        commandsCount = 0;
    }

    const embed = new EmbedBuilder()
        .setTitle("🧠 System Debug Information")
        .setColor(embedColor)
        .addFields(
            { name: "Database", value: dbState, inline: true },
            { name: "Ping", value: `${interaction.client.ws.ping}ms`, inline: true },
            { name: "Guilds Cached", value: String(interaction.client.guilds.cache.size), inline: true },
            { name: "Commands Registered", value: String(commandsCount), inline: true },
            { name: "Users in DB", value: String(totalUsers), inline: true },
            { name: "Total Lunar Points", value: String(totalXP), inline: true }, // <-- [GANTI]
            { name: "Total Expeditions", value: String(totalExpeditions), inline: true }, 
            { name: "Achievements Configured", value: String((config.achievements || []).length), inline: true },
            { name: "Lunar Points Manager Roles", value: String((config.xpManagerRoles || []).length), inline: true }, // <-- [GANTI]
            { name: "Reward Manager Roles", value: String((config.rewardManagerRoles || []).length), inline: true },
            { name: "Debug Manager Roles", value: String((config.debugManagerRoles || []).length), inline: true },
            { name: "Bot Uptime", value: `${h}h ${m}m`, inline: true },
            { name: "Node Version", value: process.version, inline: true }
        )
        .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
}