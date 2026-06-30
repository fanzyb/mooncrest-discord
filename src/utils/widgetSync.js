import fetch from "node-fetch";
import { getLevel, getRobloxAvatarBust, getRobloxUserById } from "./helpers.js";

/**
 * Synchronizes user statistics from Firestore to their Discord Profile Widget.
 * Uses robloxId as the unique identity key to prevent cross-user conflicts.
 * @param {string} discordId - The user's Discord ID.
 * @param {object} userData - The user's data from Firestore.
 * @param {number|null} rank - The user's global leaderboard rank.
 * @returns {Promise<boolean>} True if sync succeeded, false otherwise.
 */
export async function syncDiscordWidget(discordId, userData, rank = null) {
    if (!discordId) return false;

    const clientId = process.env.CLIENT_ID;
    const botToken = process.env.TOKEN;

    if (!clientId || !botToken) {
        console.warn("[WidgetSync] Skipping sync: CLIENT_ID or TOKEN env variable is missing.");
        return false;
    }

    try {
        const username = userData.robloxUsername || "Mooncrest Climber";
        const robloxId = userData.robloxId || "unknown";
        const xp = userData.xp || 0;
        const levelName = getLevel(xp).levelName;
        const expeditions = userData.expeditions || 0;
        const achievementsCount = (userData.achievements || []).length;
        const leaderboardRank = rank ? `#${rank}` : "#--";
        const weeklyXp = userData.weeklyXp || 0;

        // Fetch Roblox Avatar URL and Display Name dynamically in parallel
        let avatarUrl = null;
        let displayName = username; // Default to username if fetch fails
        if (userData.robloxId) {
            const [avatar, robloxUser] = await Promise.all([
                getRobloxAvatarBust(userData.robloxId),
                getRobloxUserById(userData.robloxId).catch(() => null)
            ]);
            avatarUrl = avatar;
            if (robloxUser) {
                displayName = robloxUser.displayName || robloxUser.name;
            }
        }
        console.log(`[WidgetSync] Roblox Avatar URL for ${username}: ${avatarUrl}`);
        console.log(`[WidgetSync] Roblox Display Name for ${username}: ${displayName}`);

        // Use robloxId as the unique identity key to avoid 40106 conflicts
        const identityUsername = `@${username}`;

        // Build the payload matching the user data fields configured in the Developer Portal
        const payload = {
            username: identityUsername,
            data: {
                dynamic: [
                    { type: 1, name: "display_name", value: String(displayName) },
                    { type: 1, name: "rank_level", value: String(levelName) },
                    { type: 1, name: "lunar_points", value: String(xp) },
                    { type: 1, name: "expeditions", value: String(expeditions) },
                    { type: 1, name: "achievements", value: String(achievementsCount) },
                    { type: 1, name: "leaderboard_rank", value: String(leaderboardRank) },
                    { type: 1, name: "weekly_points", value: String(weeklyXp) }
                ]
            }
        };

        if (avatarUrl) {
            payload.data.dynamic.push({
                type: 3,
                name: "roblox_avatar",
                value: { url: avatarUrl }
            });
        }

        const url = `https://discord.com/api/v9/applications/${clientId}/users/${discordId}/identities/0/profile`;

        const response = await fetch(url, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bot ${botToken}`,
                "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errBody = await response.text();

            // Handle error 40106: identity index 0 has a ghost record for this user
            // Fallback to identity index 1 which has been proven to work
            try {
                const errJson = JSON.parse(errBody);
                if (errJson.code === 40106 || errJson.code === 50035) {
                    console.warn(`[WidgetSync] Identity issue (${errJson.code}) for ${discordId} on index 0. Falling back to identity index 1...`);

                    const fallbackUrl = `https://discord.com/api/v9/applications/${clientId}/users/${discordId}/identities/1/profile`;
                    const retryResponse = await fetch(fallbackUrl, {
                        method: "PATCH",
                        headers: {
                            "Content-Type": "application/json",
                            "Authorization": `Bot ${botToken}`,
                            "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 1.0.0)"
                        },
                        body: JSON.stringify(payload)
                    });

                    if (retryResponse.ok) {
                        console.log(`[WidgetSync] Successfully synchronized widget for ${discordId} (${username}) using identity index 1.`);
                        return true;
                    } else {
                        const retryErr = await retryResponse.text();
                        console.error(`[WidgetSync] Index 1 fallback also failed for ${discordId}. Status: ${retryResponse.status}. Error: ${retryErr}`);
                        return false;
                    }
                }
            } catch (_) {
                // JSON parse failed, just log the original error
            }

            console.error(`[WidgetSync] API call failed for ${discordId}. Status: ${response.status}. Error: ${errBody}`);
            return false;
        }

        console.log(`[WidgetSync] Successfully synchronized Discord widget for user ${discordId} (${username}).`);
        return true;
    } catch (error) {
        console.error(`[WidgetSync] Error syncing widget for user ${discordId}:`, error);
        return false;
    }
}
