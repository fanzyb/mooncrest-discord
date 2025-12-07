import 'dotenv/config';
import axios from 'axios';

const API_KEY = process.env.ROBLOX_OPENCLOUD_API_KEY;
const GROUP_ID = 390278660;
const BASE_URL = 'https://apis.roblox.com/cloud/v2';

console.log('=== TESTING PAGINATION ===\n');

async function testGetAllRoles() {
    let allRoles = [];
    let pageToken = null;
    let pageCount = 0;

    do {
        const params = pageToken ? { pageToken } : {};

        const response = await axios.get(`${BASE_URL}/groups/${GROUP_ID}/roles`, {
            headers: { 'x-api-key': API_KEY },
            params
        });

        const roles = response.data.groupRoles || [];
        allRoles = allRoles.concat(roles);
        pageToken = response.data.nextPageToken || null;
        pageCount++;

        console.log(`Page ${pageCount}: ${roles.length} roles`);

    } while (pageToken);

    console.log(`\n✅ Total: ${allRoles.length} roles from ${pageCount} pages\n`);

    allRoles.forEach(role => {
        console.log(`   - ${role.displayName} (Rank ${role.rank}, ID: ${role.id})`);
    });

    return allRoles;
}

testGetAllRoles();
