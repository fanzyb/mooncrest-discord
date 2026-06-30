import { EmbedBuilder } from "discord.js";
import config from "../config.json" with { type: "json" };
import { findUser, saveUser } from "../db/firestore.js";
import { getLevel, syncRankRole } from "./helpers.js";

const chatCooldowns = new Map();

/**
 * Calculates boost multiplier for a member based on their roles
 * @param {import('discord.js').GuildMember} member 
 * @returns {number} Boost multiplier
 */
export function getBoostMultiplier(member) {
    if (!member) return 1.0;
    const boosts = config.leveling?.roleBoosts || {};
    let maxBoost = 1.0;
    for (const [roleId, multiplier] of Object.entries(boosts)) {
        if (member.roles.cache.has(roleId)) {
            const mult = parseFloat(multiplier);
            if (mult > maxBoost) {
                maxBoost = mult;
            }
        }
    }
    return maxBoost;
}

/**
 * Handles giving XP when a message is sent
 * @param {import('discord.js').Message} message 
 */
export async function handleChatMessage(message) {
    if (!config.leveling?.enabled) return;
    if (message.author.bot || !message.guild) return;

    // Ignore command prefixes
    if (message.content.startsWith("/") || message.content.startsWith("!")) return;

    const userId = message.author.id;
    const cooldownTime = (config.leveling.chatCooldown || 60) * 1000;
    const now = Date.now();

    if (chatCooldowns.has(userId)) {
        const lastTime = chatCooldowns.get(userId);
        if (now - lastTime < cooldownTime) return;
    }

    chatCooldowns.set(userId, now);

    // Calculate XP
    const minXp = config.leveling.chatXpMin || 5;
    const maxXp = config.leveling.chatXpMax || 15;
    let xpGained = Math.floor(Math.random() * (maxXp - minXp + 1)) + minXp;

    // Apply boost
    const boost = getBoostMultiplier(message.member);
    xpGained = Math.round(xpGained * boost);

    await addXp(message.member, xpGained, "Chat Activity", message.channel);
}

/**
 * Core function to add XP to a user and handle leveling up
 * @param {import('discord.js').GuildMember} member 
 * @param {number} amount 
 * @param {string} source 
 * @param {import('discord.js').TextChannel|null} channel 
 */
export async function addXp(member, amount, source, channel = null) {
    try {
        const userId = member.id;
        let user = await findUser(userId);

        if (!user) {
            user = {
                discordId: userId,
                xp: 0,
                weeklyXp: 0,
                monthlyXp: 0,
                expeditions: 0,
                achievements: [],
                isVerified: false
            };
        }

        const oldXp = user.xp || 0;
        const oldLevelData = getLevel(oldXp);

        user.xp = oldXp + amount;
        user.weeklyXp = (user.weeklyXp || 0) + amount;
        user.monthlyXp = (user.monthlyXp || 0) + amount;

        await saveUser(user);

        const newLevelData = getLevel(user.xp);

        // Level Up Announcement & Role Sync
        if (newLevelData.levelName !== oldLevelData.levelName) {
            await syncRankRole(member, user.xp);

            // Announcement
            const embed = new EmbedBuilder()
                .setColor(config.embedColor || "#1B1464")
                .setTitle("🎉 Level Up! 🎉")
                .setDescription(`Congratulations <@${userId}>, you have reached level **${newLevelData.levelName}**!`)
                .addFields(
                    { name: "Previous Level", value: oldLevelData.levelName, inline: true },
                    { name: "New Level", value: newLevelData.levelName, inline: true },
                    { name: "Total Lunar Points", value: `🌙 ${user.xp}`, inline: true }
                )
                .setThumbnail(member.user.displayAvatarURL())
                .setTimestamp();

            // Send to the active channel if announcement is enabled for channels, otherwise fallback to log channel
            if (channel && config.leveling?.announceInChannel) {
                await channel.send({ embeds: [embed] }).catch(() => {});
            } else {
                const logChannelId = config.xpLogChannelId;
                const logChannel = member.guild.channels.cache.get(logChannelId);
                if (logChannel) {
                    await logChannel.send({ embeds: [embed] }).catch(() => {});
                }
            }
        }
    } catch (err) {
        console.error(`[Leveling] Error adding XP to ${member.user.tag}:`, err);
    }
}

/**
 * Initializes the periodic loop that awards XP to users in voice channels
 * @param {import('discord.js').Client} client 
 */
export function initVoiceXp(client) {
    const intervalTime = (config.leveling?.voiceInterval || 60) * 1000;

    setInterval(async () => {
        if (!config.leveling?.enabled) return;

        try {
            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) return;

            // Fetch members to populate cache
            await guild.members.fetch();

            for (const [memberId, voiceState] of guild.voiceStates.cache) {
                const member = voiceState.member;
                if (!member || member.user.bot) continue;

                // Member is in a voice channel
                const channel = voiceState.channel;
                if (!channel) continue;

                // Don't award XP if deafened (self or server) or muted in voice
                if (voiceState.selfDeaf || voiceState.deaf) continue;

                // Give XP
                let xpGained = config.leveling.voiceXpAmount || 5;
                const boost = getBoostMultiplier(member);
                xpGained = Math.round(xpGained * boost);

                await addXp(member, xpGained, "Voice Activity");
            }
        } catch (err) {
            console.error("[Leveling] Voice XP loop error:", err);
        }
    }, intervalTime);
}
