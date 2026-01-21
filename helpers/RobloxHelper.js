import axios from 'axios';

/**
 * Roblox Helper - Alternatif untuk noblox.js
 * Menggunakan Roblox API langsung dengan axios
 * 
 * Gunakan ini karena noblox.js punya issue dengan cookie validation
 * meskipun cookie valid di Roblox API
 */

class RobloxHelper {
    constructor(cookie) {
        // Cookie dengan atau tanpa prefix
        this.cookie = cookie.includes('|_') ? cookie : `_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_${cookie}`;
        this.csrfToken = null;
        this.currentUser = null;
    }

    /**
     * Get headers dengan cookie
     */
    getHeaders(includeCsrf = false) {
        const headers = {
            'Cookie': `.ROBLOSECURITY=${this.cookie}`,
            'User-Agent': 'Roblox/WinInet',
            'Content-Type': 'application/json'
        };

        if (includeCsrf && this.csrfToken) {
            headers['X-CSRF-TOKEN'] = this.csrfToken;
        }

        return headers;
    }

    /**
     * Initialize - Login dan get user info
     */
    async initialize() {
        try {
            console.log('🔄 Initializing Roblox Helper...');

            // Get current user
            const response = await axios.get('https://users.roblox.com/v1/users/authenticated', {
                headers: this.getHeaders()
            });

            this.currentUser = response.data;

            console.log('✅ Login berhasil!');
            console.log('   User:', this.currentUser.name, '(ID:', this.currentUser.id + ')');

            // Get CSRF token untuk POST requests
            await this.refreshCsrfToken();

            return this.currentUser;

        } catch (error) {
            if (error.response && error.response.status === 401) {
                throw new Error('Cookie invalid atau expired. Ambil cookie baru!');
            }
            throw error;
        }
    }

    /**
     * Refresh CSRF token (diperlukan untuk POST/PATCH/DELETE)
     */
    async refreshCsrfToken() {
        try {
            // Trigger CSRF dengan request yang akan fail
            await axios.post('https://auth.roblox.com/v1/authentication-ticket', {}, {
                headers: this.getHeaders(),
                validateStatus: () => true // Accept all status codes
            });
        } catch (error) {
            if (error.response && error.response.headers['x-csrf-token']) {
                this.csrfToken = error.response.headers['x-csrf-token'];
                console.log('✅ CSRF token obtained');
            }
        }
    }

    /**
     * Get user info by user ID
     */
    async getUserInfo(userId) {
        try {
            const response = await axios.get(`https://users.roblox.com/v1/users/${userId}`, {
                headers: this.getHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Error getting user info:', error.message);
            throw error;
        }
    }

    /**
     * Get user by username
     */
    async getUserByUsername(username) {
        try {
            const response = await axios.post('https://users.roblox.com/v1/usernames/users', {
                usernames: [username],
                excludeBannedUsers: true
            }, {
                headers: this.getHeaders(true)
            });

            if (response.data.data && response.data.data.length > 0) {
                return response.data.data[0];
            }
            return null;
        } catch (error) {
            console.error('Error getting user by username:', error.message);
            throw error;
        }
    }

    /**
     * Get player thumbnail
     */
    async getPlayerThumbnail(userId, size = '420x420', format = 'Png', isCircular = false) {
        try {
            const response = await axios.get(`https://thumbnails.roblox.com/v1/users/avatar-headshot`, {
                params: {
                    userIds: userId,
                    size: size,
                    format: format,
                    isCircular: isCircular
                },
                headers: this.getHeaders()
            });

            if (response.data.data && response.data.data.length > 0) {
                return response.data.data[0].imageUrl;
            }
            return null;
        } catch (error) {
            console.error('Error getting thumbnail:', error.message);
            return null;
        }
    }

    /**
     * Get player info (friends, followers, etc)
     */
    async getPlayerInfo(userId) {
        try {
            const response = await axios.get(`https://friends.roblox.com/v1/users/${userId}/friends/count`, {
                headers: this.getHeaders()
            });

            const followersResponse = await axios.get(`https://friends.roblox.com/v1/users/${userId}/followers/count`, {
                headers: this.getHeaders()
            });

            return {
                friendCount: response.data.count,
                followerCount: followersResponse.data.count
            };
        } catch (error) {
            console.error('Error getting player info:', error.message);
            return null;
        }
    }

    /**
     * Get all roles in a Roblox group
     */
    async getGroupRoles(groupId) {
        try {
            const response = await axios.get(`https://groups.roblox.com/v1/groups/${groupId}/roles`, {
                headers: this.getHeaders()
            });

            return response.data.roles;
        } catch (error) {
            console.error('Error getting group roles:', error.message);
            throw error;
        }
    }

    /**
     * Get user's current role in a group
     */
    async getUserRankInGroup(userId, groupId) {
        try {
            const response = await axios.get(`https://groups.roblox.com/v1/users/${userId}/groups/roles`, {
                headers: this.getHeaders()
            });

            const groupData = response.data.data.find(g => g.group.id === groupId);

            if (!groupData) {
                return null; // User not in group
            }

            return {
                roleId: groupData.role.id,
                roleName: groupData.role.name,
                rank: groupData.role.rank
            };
        } catch (error) {
            console.error('Error getting user rank in group:', error.message);
            throw error;
        }
    }

    /**
     * Set user's rank in group (promote/demote)
     * Requires bot to have permission in the group
     */
    async setUserRank(userId, groupId, roleId) {
        try {
            // Ensure we have CSRF token
            if (!this.csrfToken) {
                await this.refreshCsrfToken();
            }

            const response = await axios.patch(
                `https://groups.roblox.com/v1/groups/${groupId}/users/${userId}`,
                {
                    roleId: roleId
                },
                {
                    headers: this.getHeaders(true) // Include CSRF
                }
            );

            return {
                success: true,
                newRole: response.data
            };
        } catch (error) {
            // Handle specific errors
            if (error.response) {
                const status = error.response.status;
                const errorData = error.response.data;

                if (status === 403) {
                    if (error.response.headers['x-csrf-token']) {
                        // CSRF token was invalid, refresh and retry
                        this.csrfToken = error.response.headers['x-csrf-token'];
                        return await this.setUserRank(userId, groupId, roleId); // Retry once
                    }
                    throw new Error('Bot does not have permission to change ranks in this group');
                } else if (status === 401) {
                    throw new Error('Bot is not authenticated (cookie invalid/expired)');
                } else if (status === 400) {
                    throw new Error(errorData?.errors?.[0]?.message || 'Invalid request (user not in group or invalid role)');
                }
            }

            console.error('Error setting user rank:', error.message);
            throw error;
        }
    }

    /**
     * Check if user is in a specific group
     */
    async isUserInGroup(userId, groupId) {
        try {
            const rank = await this.getUserRankInGroup(userId, groupId);
            return rank !== null;
        } catch {
            return false;
        }
    }

    /**
     * Get role ID by role name
     */
    async getRoleIdByName(groupId, roleName) {
        try {
            const roles = await this.getGroupRoles(groupId);
            const role = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase());
            return role ? role.id : null;
        } catch (error) {
            console.error('Error getting role ID by name:', error.message);
            return null;
        }
    }

    /**
     * Get current user
     */
    getCurrentUser() {
        return this.currentUser;
    }
}

// Export
export default RobloxHelper;

// Test jika dijalankan langsung
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    const COOKIE = process.env.ROBLOX_COOKIE || '_|WARNING:-DO-NOT-SHARE-THIS.--Sharing-this-will-allow-someone-to-log-in-as-you-and-to-steal-your-ROBUX-and-items.|_CAEaAhADIhsKBGR1aWQSEzU3MjQ1MTA2NDMxMzEyNDU5MzEoAw.o3iG9AiLm_xaQciXaSa3XrqiqnJBVovatkba423W1uaUlEaGvnuRgUfj9pTVXbOgh1l6tp4C_GxIlspvDXMSj3SQqCXyA9JKf4Hl-MGtLOKwx3-Igno5BjWT1hIE3pUISEI_FRwOMcroAPqN7AfL-WPBjge00W5FAf7PHWnPpn4KjmuX2IQclrhU_YAWeJVRmKomWe_ZTNP4oddLVMZp2ZVTLQqVZGMDY_PPs6iLBfz3ZJvPgrMiKyzcH5nLIc680SdFyrRyUwagg_OgrU7GrXxzyaN7Z440XP81aa_QHH9az5t2TopKpgY-SjmZNxE9HHu244M53fqWfN_vLRO_-uL0GEGtYRN6Ad6TtHXKO77hInr8worRZdTNlkXdwUF9i3AB6OufmMKnIOWy1ZsaIcduVIr0xAwWHbv8RtB8DM_jtd14';

    (async () => {
        try {
            console.log('=== ROBLOX HELPER TEST ===\n');

            const roblox = new RobloxHelper(COOKIE);

            // Initialize and login
            await roblox.initialize();

            const user = roblox.getCurrentUser();
            console.log('\n📊 User Details:');
            console.log('   - ID:', user.id);
            console.log('   - Username:', user.name);
            console.log('   - Display Name:', user.displayName);

            // Get additional info
            const playerInfo = await roblox.getPlayerInfo(user.id);
            if (playerInfo) {
                console.log('   - Friends:', playerInfo.friendCount);
                console.log('   - Followers:', playerInfo.followerCount);
            }

            // Get thumbnail
            const thumbnail = await roblox.getPlayerThumbnail(user.id);
            if (thumbnail) {
                console.log('   - Avatar URL:', thumbnail);
            }

            console.log('\n✅ Semua fungsi bekerja dengan baik!');
            console.log('💡 Gunakan RobloxHelper ini sebagai pengganti noblox.js\n');

        } catch (error) {
            console.error('\n❌ Error:', error.message);
            console.error(error);
            process.exit(1);
        }
    })();
}
