import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { embedColor, getGuideLevel, syncDepartmentRole } from "../utils/helpers.js";
import { findUserByDiscordId, saveUser } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("guide")
    .setDescription("Manage a linked Discord user's Guide Points (Guide Manager only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add Guide points to a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Points amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("remove").setDescription("Remove Guide points from a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Points amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("set").setDescription("Set Guide points for a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Points amount").setRequired(true))
    );

export async function execute(interaction) {
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.guideManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You must be an Administrator or a Guide Manager to use this command.", ephemeral: true });

        await interaction.deferReply({ ephemeral: false });

        const action = interaction.options.getSubcommand();
        const member = interaction.options.getMember("member");
        const amount = interaction.options.getInteger("amount");

        const userFromDb = await findUserByDiscordId(member.id);
        if (!userFromDb) {
            return interaction.editReply({ content: `❌ User <@${member.id}> is not linked to a Roblox account.` });
        }

        let user = userFromDb;
        const oldPoints = user.guidePoints || 0;
        const oldLevel = getGuideLevel(oldPoints).levelName;

        if (action === "add") {
            user.guidePoints = (user.guidePoints || 0) + amount;
            user.weeklyGuidePoints = (user.weeklyGuidePoints || 0) + amount; // --- [BARU]
            user.monthlyGuidePoints = (user.monthlyGuidePoints || 0) + amount;
        } else if (action === "remove") {
            user.guidePoints = Math.max((user.guidePoints || 0) - amount, 0);
            user.weeklyGuidePoints = Math.max((user.weeklyGuidePoints || 0) - amount, 0); // --- [BARU]
            user.monthlyGuidePoints = Math.max((user.monthlyGuidePoints || 0) - amount, 0);
        } else if (action === "set") {
            user.guidePoints = amount;
        }

        await saveUser(user);

        const newPoints = user.guidePoints;
        const newLevel = getGuideLevel(newPoints).levelName;
        let levelMsg = newLevel !== oldLevel ? ` 🎉 **${member.displayName} has leveled up to ${newLevel}!**` : "";
        let responseMessage = `✅ Successfully performed '${action}' action with ${amount} Guide Points for **${member.displayName}** (linked to <@${member.id}>). Total Points: ${newPoints}.${levelMsg}`;

        // Auto-role sync
        if (newLevel !== oldLevel) {
            const allGuideRoleIds = (config.guideRanks || []).map(r => r.roleId);
            const newRole = await syncDepartmentRole(member, getGuideLevel(newPoints).roleId, allGuideRoleIds);
            if (newRole) {
                responseMessage += `\n👑 Their Guide role has been updated to **${newRole.name}**!`;
            }
        }

        await interaction.editReply({ content: responseMessage });

        // Logging
        try {
            const logChannel = interaction.guild.channels.cache.get(config.xpLogChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder().setTitle("🧭 Guide Points Log").setColor("#FFD700")
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
        } catch (logErr) {}

    } catch (error) {
        logError(error, interaction, "guide");
        await interaction.editReply({ content: "❌ Error processing command." });
    }
}