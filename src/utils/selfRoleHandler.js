import { logError } from "./errorLogger.js"; //
import fs from "fs";
import path from "path";

// Tentukan path ke self-roles.json
const rolesFilePath = path.join(process.cwd(), 'self-roles.json');

/**
 * Handler untuk interaksi dropdown self-role
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
export async function handleSelfRoleMenu(interaction) {
    const commandName = `selfrole:${interaction.customId}`;
    try {
        await interaction.deferReply({ flags: 64 }); // Balasan ephemeral

        let selfRolesData;
        try {
            const rawData = fs.readFileSync(rolesFilePath, 'utf8');
            selfRolesData = JSON.parse(rawData);
        } catch (e) {
            logError(e, interaction, "handleSelfRoleMenu - read file");
            return interaction.editReply({ content: "❌ An error occurred: Could not read role configuration." });
        }

        // Ambil index menu dari customId (mis. "selfrole_menu_0")
        const menuIndex = parseInt(interaction.customId.split('_')[2]);
        const menuConfig = selfRolesData[menuIndex];

        if (!menuConfig) {
            return interaction.editReply({ content: "❌ An error occurred: This menu is outdated." });
        }

        const member = interaction.member;
        const selectedRoleIds = interaction.values; // Array ID role yang dipilih user
        const allRoleIdsInMenu = menuConfig.roles.map(r => r.roleId);

        const rolesToAdd = [];
        const rolesToRemove = [];
        const addedRolesNames = [];
        const removedRolesNames = [];

        // Logika Toggle
        for (const roleId of allRoleIdsInMenu) {
            const hasRole = member.roles.cache.has(roleId);
            const selected = selectedRoleIds.includes(roleId);
            const roleName = menuConfig.roles.find(r => r.roleId === roleId)?.label;

            if (selected && !hasRole) {
                // User memilih ini, tapi belum punya -> Tambahkan
                rolesToAdd.push(roleId);
                addedRolesNames.push(roleName || roleId);
            } else if (!selected && hasRole) {
                // User TIDAK memilih ini, tapi punya -> Hapus
                rolesToRemove.push(roleId);
                removedRolesNames.push(roleName || roleId);
            }
        }

        // Lakukan aksi
        if (rolesToRemove.length > 0) {
            await member.roles.remove(rolesToRemove, "Self-role update");
        }
        if (rolesToAdd.length > 0) {
            await member.roles.add(rolesToAdd, "Self-role update");
        }

        // Buat pesan konfirmasi (seperti di image_7eb86a.png)
        let replyMessage = "Your roles have been updated!";
        if (addedRolesNames.length > 0) {
            replyMessage += `\n✅ Added role(s): **${addedRolesNames.join(", ")}**`;
        }
        if (removedRolesNames.length > 0) {
            replyMessage += `\n❌ Removed role(s): **${removedRolesNames.join(", ")}**`;
        }

        await interaction.editReply({ content: replyMessage });

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while updating your roles." });
        }
    }
}