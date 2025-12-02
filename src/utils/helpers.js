import fetch from "node-fetch";
import config from "../config.json" with { type: "json" };

export const levels = config.levels || [];
export const achievementsConfig = config.achievements || [];
export const embedColor = config.embedColor;
export const rewardManagerRoles = config.rewardManagerRoles || [];

export async function performVerification(member, robloxData, isInGroup = null) {
    // ... (kode tetap sama) ...
    const verifiedRoleId = config.verifiedRoleId;
    const verifiedRole = member.guild.roles.cache.get(verifiedRoleId);
    const groupId = config.groupId;

    if (!verifiedRole) {
        throw new Error("The verified role ID is invalid or not found in the server.");
    }
    if (isInGroup === null) {
        isInGroup = await isInRobloxGroup(robloxData.id, groupId);
    }
    if (!isInGroup) {
        throw new Error("NOT_IN_GROUP");
    }

    let nicknameWarning = null;
    const newNickname = `${robloxData.displayName} (@${robloxData.name})`;
    try {
        if (member.manageable) {
            await member.setNickname(newNickname);
        } else {
            throw new Error("Cannot manage this member.");
        }
    } catch (e) {
        console.error(`Failed to set nickname for ${member.user.tag}: ${e.message}`);
        nicknameWarning = `⚠️ Could not change your nickname. This might be because you are the server owner or have a higher role than the bot.`;
    }

    if (!member.roles.cache.has(verifiedRoleId)) {
        await member.roles.add(verifiedRole);
    }
    return { newNickname, nicknameWarning };
}

export async function getRobloxUser(username) {
    // ... (kode tetap sama) ...
    try {
        const res = await fetch(`https://users.roblox.com/v1/usernames/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernames: [username] })
        });
        const data = await res.json();
        if (!data.data || data.data.length === 0) return null;
        return data.data[0];
    } catch (e) {
        console.error("Roblox user fetch error:", e);
        return null;
    }
}

export async function getRobloxUserById(userId) {
    try {
        const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
        const data = await res.json();
        if (data && data.name) {
            return data; // { description, created, isBanned, externalAppDisplayName, hasVerifiedBadge, id, name, displayName }
        }
        return null;
    } catch (e) {
        console.error("Roblox user fetch by ID error:", e);
        return null;
    }
}

export async function getRobloxAvatar(userId) {
    // ... (kode tetap sama) ...
    try {
        const res = await fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=png`);
        const data = await res.json();
        if (!data.data || data.data.length === 0) return null;
        return data.data[0].imageUrl;
    } catch (e) {
        return null;
    }
}

export async function isInRobloxGroup(userId, groupId = config.groupId) {
    // ... (kode tetap sama) ...
    try {
        const res = await fetch(`https://groups.roblox.com/v1/users/${userId}/groups/roles`);
        const data = await res.json();
        if (!data || !data.data) return false;
        return data.data.some(g => g.group.id === groupId);
    } catch (e) {
        return false;
    }
}

export async function getRobloxGroupData(groupId = config.groupId) {
    // ... (kode tetap sama) ...
    try {
        const res = await fetch(`https://groups.roblox.com/v1/groups/${groupId}`);
        const data = await res.json();
        if (data && typeof data.memberCount === 'number' && data.name) {
            return { name: data.name, memberCount: data.memberCount };
        }
        return { name: "Roblox Group", memberCount: 0 };
    } catch (e) {
        console.error("Roblox group data fetch error:", e);
        return { name: "Roblox Group", memberCount: 0 };
    }
}

export async function removeVerification(member) {
    // ... (kode tetap sama) ...
    const verifiedRoleId = config.verifiedRoleId;
    if (member.roles.cache.has(verifiedRoleId)) {
        try {
            await member.roles.remove(verifiedRoleId);
        } catch (e) {
            console.error(`Failed to remove role from ${member.user.tag}:`, e.message);
            throw new Error("Could not remove the verified role. Check bot permissions and role hierarchy.");
        }
    }
    if (member.nickname) {
        try {
            await member.setNickname(null);
        } catch (e) {
            console.error(`Failed to reset nickname for ${member.user.tag}:`, e.message);
            throw new Error("Could not reset the nickname. Check bot permissions and role hierarchy.");
        }
    }
}

export async function getRoverVerification(discordId, guildId) {
    // ... (kode tetap sama) ...
    if (!process.env.ROVER_API_KEY) {
        console.warn("[WARN] ROVER_API_KEY not found. RoVer integration is skipped.");
        return null;
    }
    try {
        const res = await fetch(`https://registry.rover.link/api/guilds/${guildId}/discord-to-roblox/${discordId}`, {
            headers: { "Authorization": `Bearer ${process.env.ROVER_API_KEY}` }
        });
        if (res.status === 404) return null;
        const data = await res.json();
        if (data && data.robloxId) {
            return { robloxId: data.robloxId.toString(), robloxUsername: data.cachedUsername };
        }
        return null;
    } catch (e) {
        console.error("RoVer API fetch error:", e);
        return null;
    }
}

export async function getRobloxRankName(robloxId) {
    // ... (kode tetap sama) ...
    try {
        const res = await fetch(`https://groups.roblox.com/v1/users/${robloxId}/groups/roles`);
        const data = await res.json();
        const groupInfo = data.data.find(g => g.group.id === config.groupId);
        if (groupInfo) {
            return groupInfo.role.name;
        }
        return "Guest";
    } catch (error) {
        console.error(`[ERROR] Failed to get rank from public API for ${robloxId}:`, error.message);
        return null;
    }
}

export function getLevel(xp) {
    if (!levels.length) return { levelName: "N/A", bar: "⬜".repeat(10), progressPercent: 0, xpNeededText: "No levels configured" };
    let level = levels[0];
    for (const l of levels) {
        if (xp >= l.xp) level = l;
        else break;
    }
    const nextLevel = levels[levels.indexOf(level) + 1] || null;
    let progressPercent = 100;
    let bar = "⬜".repeat(10);
    let xpNeededText = "🎉 Max level reached!";
    if (nextLevel) {
        const currentXP = xp - level.xp;
        const neededXP = nextLevel.xp - level.xp;
        progressPercent = Math.floor((currentXP / neededXP) * 100);
        const filled = Math.max(0, Math.min(10, Math.floor(progressPercent / 10)));
        const empty = 10 - filled;
        bar = "⬜".repeat(filled) + "🔳".repeat(empty);
        xpNeededText = `Needs **${Math.max(0, neededXP - currentXP)} 🌙 Lunar Points** to reach **${nextLevel.name}**`; // <-- [GANTI]
    }
    return { levelName: level.name, bar, progressPercent, xpNeededText };
}

export async function syncRankRole(member, xp) {
    // ... (kode tetap sama) ...
    try {
        const rankMapping = config.rankToRoleMapping || {};
        const allRankRoleIds = Object.values(rankMapping);

        if (allRankRoleIds.length === 0) {
            console.warn("[WARN] 'rankToRoleMapping' di config.json kosong. Melewatkan sinkronisasi role rank.");
            return null;
        }

        const levelName = getLevel(xp).levelName;
        const targetRoleId = rankMapping[levelName];
        const targetRole = targetRoleId ? member.guild.roles.cache.get(targetRoleId) : null;

        const rolesToRemove = member.roles.cache.filter(role =>
            allRankRoleIds.includes(role.id) && role.id !== targetRoleId
        );

        if (rolesToRemove.size > 0) {
            await member.roles.remove(rolesToRemove);
        }

        if (targetRole && !member.roles.cache.has(targetRoleId)) {
            await member.roles.add(targetRole);
            return targetRole;
        }

        return targetRole;

    } catch (error) {
        console.error(`[ERROR] Gagal menyinkronkan role rank untuk ${member.user.tag}: ${error.message}`);
        return null;
    }
}

// --- [FUNGSI UNTUK GUIDE & SAR] ---

export function getGuideLevel(points) {
    // ... (kode tetap sama) ...
    const ranks = config.guideRanks || [];
    if (!ranks.length) return { levelName: "N/A", roleId: null };

    let currentRank = ranks[0];
    for (const rank of ranks) {
        if (points >= rank.points) currentRank = rank;
        else break;
    }
    return { levelName: currentRank.name, roleId: currentRank.roleId };
}

export function getSarLevel(points) {
    // ... (kode tetap sama) ...
    const ranks = config.sarRanks || [];
    if (!ranks.length) return { levelName: "N/A", roleId: null };

    let currentRank = ranks[0];
    for (const rank of ranks) {
        if (points >= rank.points) currentRank = rank;
        else break;
    }
    return { levelName: currentRank.name, roleId: currentRank.roleId };
}

export async function syncDepartmentRole(member, targetRoleId, allRankRoleIds) {
    // ... (kode tetap sama) ...
    try {
        if (!targetRoleId || allRankRoleIds.length === 0) {
            console.warn("[WARN] syncDepartmentRole: Role mapping kosong.");
            return null;
        }

        const targetRole = member.guild.roles.cache.get(targetRoleId);
        if (!targetRole) {
            console.error(`[ERROR] Role departemen dengan ID '${targetRoleId}' tidak ditemukan.`);
            return null;
        }

        const rolesToRemove = member.roles.cache.filter(role =>
            allRankRoleIds.includes(role.id) && role.id !== targetRoleId
        );

        if (rolesToRemove.size > 0) {
            await member.roles.remove(rolesToRemove);
        }

        if (!member.roles.cache.has(targetRoleId)) {
            await member.roles.add(targetRole);
            return targetRole;
        }

        return targetRole;

    } catch (error) {
        console.error(`[ERROR] Gagal menyinkronkan role departemen untuk ${member.user.tag}: ${error.message}`);
        return null;
    }
}