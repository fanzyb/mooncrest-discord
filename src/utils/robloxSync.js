import RobloxHelper from "../../helpers/RobloxHelper.js";
import config from "../config.json" with { type: "json" };
import { getLevel } from "./helpers.js";

/**
 * Sync user's Roblox rank based on their Discord XP level
 * @param {string} robloxId - User's Roblox ID
 * @param {number} xp - User's current XP
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function syncRobloxRank(robloxId, xp) {
    try {
        const cookie = process.env.ROBLOX_COOKIE;

        if (!cookie || cookie === 'MASUKKAN_COOKIE_DISINI') {
            console.warn('[RobloxSync] ROBLOX_COOKIE not configured, skipping rank sync');
            return { success: false, message: 'Cookie not configured' };
        }

        // Get user's level based on XP
        const { levelName } = getLevel(xp);

        // Get corresponding Roblox role ID
        const targetRoleId = config.robloxLevelMapping[levelName];

        if (!targetRoleId) {
            console.warn(`[RobloxSync] No role mapping for level: ${levelName}`);
            return { success: false, message: `No role mapping for level: ${levelName}` };
        }

        // Initialize Roblox helper
        const roblox = new RobloxHelper(cookie);
        await roblox.initialize();

        const groupId = config.groupId;

        // Check if user is in group
        const currentRank = await roblox.getUserRankInGroup(robloxId, groupId);

        if (!currentRank) {
            console.warn(`[RobloxSync] User ${robloxId} not in group ${groupId}`);
            return { success: false, message: 'User not in group' };
        }

        // Check if user has special role (rank > 151) - skip syncing
        // Rank 1-151: Level system (Climber → Lunatic) - auto-sync ✅
        // Rank 240+: Special roles (Crest Alliance, Booster, Donatur, Staff, etc) - skip ⏭️
        if (currentRank.rank > 151) {
            console.log(`[RobloxSync] ⏭️ Skipping ${robloxId}: User has special role (${currentRank.roleName}, rank ${currentRank.rank})`);
            return { success: false, message: 'Skipped - User has special role' };
        }

        // Check if rank already matches
        if (currentRank.roleId === targetRoleId) {
            console.log(`[RobloxSync] User ${robloxId} already has correct rank: ${levelName}`);
            return { success: true, message: 'Already correct rank' };
        }

        // Update rank
        await roblox.setUserRank(robloxId, groupId, targetRoleId);

        console.log(`[RobloxSync] ✅ Synced ${robloxId}: ${currentRank.roleName} → ${levelName}`);

        return {
            success: true,
            message: `Rank updated from ${currentRank.roleName} to ${levelName}`
        };

    } catch (error) {
        console.error(`[RobloxSync] Error syncing rank for ${robloxId}:`, error.message);
        return {
            success: false,
            message: `Error: ${error.message}`
        };
    }
}
