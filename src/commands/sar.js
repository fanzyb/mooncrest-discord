import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { embedColor, getSarLevel, syncDepartmentRole } from "../utils/helpers.js";
import { findUserByDiscordId, saveUser } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
// [REVISI] Hapus import deptRanks
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("sar")
    .setDescription("Manage a linked Discord user's SAR Points (SAR Manager only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add SAR points to a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Points amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("remove").setDescription("Remove SAR points from a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Points amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("set").setDescription("Set SAR points for a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Points amount").setRequired(true))
    );

export async function execute(interaction) {
    try {
        // [REVISI] Menggunakan role 'sarManagerRoles' dari config
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.sarManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You must be an Administrator or a SAR Manager to use this command.", ephemeral: true });

        await interaction.deferReply({ ephemeral: false });

        const action = interaction.options.getSubcommand();
        const member = interaction.options.getMember("member");
        const amount = interaction.options.getInteger("amount");

        const userFromDb = await findUserByDiscordId(member.id);
        if (!userFromDb) {
            return interaction.editReply({ content: `❌ User <@${member.id}> is not linked to a Roblox account. They need to use \`/verify\` first.` });
        }

        let user = userFromDb;
        const oldPoints = user.sarPoints || 0;
        const oldLevel = getSarLevel(oldPoints).levelName;

        if (action === "add") {
            user.sarPoints = (user.sarPoints || 0) + amount;
        } else if (action === "remove") {
            user.sarPoints = Math.max((user.sarPoints || 0) - amount, 0);
        } else if (action === "set") {
            user.sarPoints = amount;
        }
        // Tidak ada penambahan user.expeditions

        await saveUser(user);

        const newPoints = user.sarPoints;
        const newLevel = getSarLevel(newPoints).levelName;
        let levelMsg = newLevel !== oldLevel ? ` 🎉 **${member.displayName} has leveled up to ${newLevel}!**` : "";
        let responseMessage = `✅ Successfully performed '${action}' action with ${amount} SAR Points for **${member.displayName}** (linked to <@${member.id}>). Total Points: ${newPoints}.${levelMsg}`;

        // Auto-role sync
        if (newLevel !== oldLevel) {
            // [REVISI] Baca dari config.sarRanks
            const allSarRoleIds = (config.sarRanks || []).map(r => r.roleId);
            const newRole = await syncDepartmentRole(member, getSarLevel(newPoints).roleId, allSarRoleIds);
            if (newRole) {
                responseMessage += `\n👑 Their SAR role has been updated to **${newRole.name}**!`;
            }
        }

        await interaction.editReply({ content: responseMessage });

        // Logging
        try {
            const logChannel = interaction.guild.channels.cache.get(config.xpLogChannelId); // Bisa pakai log channel yang sama
            if (logChannel) {
                const logEmbed = new EmbedBuilder().setTitle("⛑️ SAR Points Log").setColor("#FF4500") // Oranye-Merah
                    .addFields(
                        { name: "Action", value: action, inline: true },
                        { name: "Amount", value: amount.toString(), inline: true },
                        { name: "Target Discord", value: `<@${member.id}>`, inline: true },
                        { name: "By", value: interaction.user.tag, inline: true },
                        { name: "Old Points", value: oldPoints.toString(), inline: true },
                        { name: "New Points", value: newPoints.toString(), inline: true }
                    ).setTimestamp();
                await logChannel.send({ embeds: [logEmbed] });
            }
        } catch (logErr) {
            console.error("Failed to send SAR log:", logErr);
        }

    } catch (error) {
        logError(error, interaction, "sar");
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}