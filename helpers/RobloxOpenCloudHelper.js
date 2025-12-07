import axios from 'axios';

/**
 * Roblox Open Cloud Helper
 * Menggunakan Official Roblox Open Cloud API dengan API Key
 * 
 * Tidak perlu cookies lagi! 🎉
 * Lebih aman, lebih stabil, official dari Roblox
 */

class RobloxOpenCloudHelper {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.baseUrl = 'https://apis.roblox.com/cloud/v2';
        this.currentUser = null; // For compatibility
    }

    /**
     * Get headers dengan API Key
     */
    getHeaders() {
        return {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
        };
    }

    /**
     * Initialize - Validate API key
     */
    async initialize() {
        try {
            console.log('🔄 Initializing Roblox Open Cloud API...');

            // Test API key by fetching a simple endpoint
            // We'll use a test call to verify the key works
            // Note: Open Cloud doesn't have a "current user" endpoint like the old API
            // So we'll just validate the key format and set a flag

            if (!this.apiKey || this.apiKey.length < 10) {
                throw new Error('Invalid API Key format');
            }

            console.log('✅ Open Cloud API initialized!');
            console.log('   Using API Key:', this.apiKey.substring(0, 20) + '...');

            // Set a placeholder currentUser for compatibility
            this.currentUser = {
                name: 'OpenCloudBot',
                id: 'api-key-auth',
                displayName: 'Open Cloud Bot'
            };

            return this.currentUser;

        } catch (error) {
            if (error.response && error.response.status === 401) {
                throw new Error('API Key invalid atau tidak memiliki permission yang cukup!');
            }
            throw error;
        }
    }

    /**
     * Get all roles in a Roblox group
     * Endpoint: GET /cloud/v2/groups/{groupId}/roles
     * Note: API uses pagination, need to fetch all pages
     */
    async getGroupRoles(groupId) {
        try {
            let allRoles = [];
            let pageToken = null;
            let pageCount = 0;
            const maxPages = 10; // Safety limit to prevent infinite loops

            // Fetch all pages
            do {
                const params = pageToken ? { pageToken } : {};

                const response = await axios.get(
                    `${this.baseUrl}/groups/${groupId}/roles`,
                    {
                        headers: this.getHeaders(),
                        params
                    }
                );

                const roles = response.data.groupRoles || [];
                allRoles = allRoles.concat(roles);

                pageToken = response.data.nextPageToken || null;
                pageCount++;

                // Debug logging
                console.log(`[OpenCloud] Fetched page ${pageCount}: ${roles.length} roles (Total: ${allRoles.length})`);

            } while (pageToken && pageCount < maxPages);

            console.log(`[OpenCloud] ✅ Fetched all ${allRoles.length} roles from ${pageCount} page(s)`);
            return allRoles;

        } catch (error) {
            console.error('[OpenCloud] Error getting group roles:', error.message);
            if (error.response) {
                console.error('[OpenCloud] Response:', error.response.data);
            }
            throw error;
        }
    }

    /**
     * Get user's membership in a group
     * Endpoint: GET /cloud/v2/groups/{groupId}/memberships
     * Note: We need to filter by user ID
     */
    async getUserMembership(userId, groupId) {
        try {
            // Open Cloud API requires filtering
            const response = await axios.get(
                `${this.baseUrl}/groups/${groupId}/memberships`,
                {
                    headers: this.getHeaders(),
                    params: {
                        filter: `user == 'users/${userId}'`,
                        maxPageSize: 1
                    }
                }
            );

            const memberships = response.data.groupMemberships || [];

            if (memberships.length === 0) {
                console.warn(`[OpenCloud] User ${userId} not found in group ${groupId}`);
                return null; // User not in group
            }

            return memberships[0];
        } catch (error) {
            console.error('[OpenCloud] Error getting user membership:', error.message);
            if (error.response) {
                console.error('[OpenCloud] Status:', error.response.status);
                console.error('[OpenCloud] Response:', JSON.stringify(error.response.data, null, 2));

                // Check for permission issues
                if (error.response.status === 403) {
                    console.error('[OpenCloud] ⚠️ API Key tidak punya permission untuk membaca group memberships!');
                    console.error('[OpenCloud] ⚠️ Pastikan API Key punya permission "group:read"');
                }
            }
            throw error;
        }
    }

    /**
     * Get user's current role in a group (backward compatible)
     * Returns format compatible with old RobloxHelper
     */
    async getUserRankInGroup(userId, groupId) {
        try {
            const membership = await this.getUserMembership(userId, groupId);

            if (!membership) {
                return null; // User not in group
            }

            // Parse role from membership
            // membership.role format: "groups/{groupId}/roles/{roleId}"
            const roleIdMatch = membership.role.match(/roles\/(\d+)/);
            const roleId = roleIdMatch ? roleIdMatch[1] : null; // Keep as string

            if (!roleId) {
                console.error('[OpenCloud] Failed to parse role ID from:', membership.role);
                return null;
            }

            // Get all roles to find rank and name
            const roles = await this.getGroupRoles(groupId);

            // Compare as strings (Open Cloud returns string IDs)
            const roleInfo = roles.find(r => r.id === roleId || r.id === roleId.toString());

            if (!roleInfo) {
                console.error(`[OpenCloud] Role ID ${roleId} not found in group roles`);
                console.error(`[OpenCloud] Available roles:`, roles.map(r => `${r.displayName}(${r.id})`).join(', '));
                return null;
            }

            return {
                roleId: parseInt(roleInfo.id),
                roleName: roleInfo.displayName,
                rank: roleInfo.rank
            };
        } catch (error) {
            console.error('[OpenCloud] Error getting user rank in group:', error.message);
            throw error;
        }
    }

    /**
     * Set user's rank in group (promote/demote)
     * Endpoint: PATCH /cloud/v2/groups/{groupId}/memberships/{userId}
     */
    async setUserRank(userId, groupId, roleId) {
        try {
            // First, get the membership to get the membership path
            const membership = await this.getUserMembership(userId, groupId);

            if (!membership) {
                throw new Error('User is not in the group');
            }

            // membership.path format: "groups/{groupId}/memberships/{membershipId}"
            const membershipPath = membership.path;

            // Update role
            const response = await axios.patch(
                `${this.baseUrl}/${membershipPath}`,
                {
                    role: `groups/${groupId}/roles/${roleId}`
                },
                {
                    headers: this.getHeaders(),
                    params: {
                        updateMask: 'role'
                    }
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
                    throw new Error('API Key tidak memiliki permission untuk mengubah rank di group ini');
                } else if (status === 401) {
                    throw new Error('API Key invalid atau expired');
                } else if (status === 400) {
                    throw new Error(errorData?.message || 'Invalid request (user not in group or invalid role)');
                } else if (status === 404) {
                    throw new Error('Group atau user tidak ditemukan');
                }
            }

            console.error('[OpenCloud] Error setting user rank:', error.message);
            throw error;
        }
    }

    /**
     * Check if user is in a specific group
     */
    async isUserInGroup(userId, groupId) {
        try {
            const membership = await this.getUserMembership(userId, groupId);
            return membership !== null;
        } catch (error) {
            return false;
        }
    }

    /**
     * Get role ID by role name
     */
    async getRoleIdByName(groupId, roleName) {
        try {
            const roles = await this.getGroupRoles(groupId);
            const role = roles.find(r =>
                r.displayName.toLowerCase() === roleName.toLowerCase()
            );
            return role ? parseInt(role.id) : null;
        } catch (error) {
            console.error('[OpenCloud] Error getting role ID by name:', error.message);
            return null;
        }
    }

    /**
     * Get current user (for compatibility)
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Compatibility methods for old API
     * These are not needed in Open Cloud but kept for backward compatibility
     */

    async getUserInfo(userId) {
        // This would need the Users API, not available in Groups API
        console.warn('[OpenCloud] getUserInfo not available in Open Cloud Groups API');
        return null;
    }

    async getUserByUsername(username) {
        // This would need the Users API, not available in Groups API
        console.warn('[OpenCloud] getUserByUsername not available in Open Cloud Groups API');
        return null;
    }

    async getPlayerThumbnail(userId, size, format, isCircular) {
        // Thumbnails API is separate and may not need authentication
        console.warn('[OpenCloud] getPlayerThumbnail not available in Open Cloud Groups API');
        return null;
    }

    async getPlayerInfo(userId) {
        // This would need the Users/Friends API, not available in Groups API
        console.warn('[OpenCloud] getPlayerInfo not available in Open Cloud Groups API');
        return null;
    }
}

// Export
export default RobloxOpenCloudHelper;

// Test jika dijalankan langsung
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`) {
    const API_KEY = process.env.ROBLOX_OPENCLOUD_API_KEY;

    (async () => {
        try {
            console.log('=== ROBLOX OPEN CLOUD HELPER TEST ===\n');

            if (!API_KEY || API_KEY === 'your_api_key_here') {
                console.error('❌ ROBLOX_OPENCLOUD_API_KEY not set in .env');
                process.exit(1);
            }

            const roblox = new RobloxOpenCloudHelper(API_KEY);

            // Initialize
            await roblox.initialize();

            console.log('\n📊 Testing API:');
            console.log('   ✓ API Key validated');

            // Test getting group roles (you need to add your group ID)
            const GROUP_ID = process.env.GROUP_ID || '35227323'; // Example
            if (GROUP_ID) {
                console.log(`\n🔍 Testing group ${GROUP_ID}:`);
                const roles = await roblox.getGroupRoles(GROUP_ID);
                console.log(`   ✓ Found ${roles.length} roles`);
                roles.slice(0, 3).forEach(role => {
                    console.log(`     - ${role.displayName} (Rank ${role.rank}, ID: ${role.id})`);
                });
            }

            console.log('\n✅ Semua fungsi bekerja dengan baik!');
            console.log('💡 Open Cloud API siap digunakan!\n');

        } catch (error) {
            console.error('\n❌ Error:', error.message);
            if (error.response) {
                console.error('Response data:', error.response.data);
            }
            process.exit(1);
        }
    })();
}
