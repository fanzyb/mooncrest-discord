import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getRobloxUser, isInRobloxGroup, embedColor } from "../utils/helpers.js";
import { findUserByDiscordId, saveUser } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("expod")
    // ... definisi command tetap sama ...
    .setDescription("Manage a linked Discord user's Expedition count (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add expeditions count to a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Expedition amount").setRequired(true)))
    .addSubcommand(sub =>
        sub.setName("remove").setDescription("Remove expeditions count from a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Expedition amount").setRequired(true)))
    .addSubcommand(sub =>
        sub.setName("set").setDescription("Set expeditions count for a linked user")
            .addUserOption(opt => opt.setName("member").setDescription("The Discord member to manage").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Expedition amount").setRequired(true)));

export async function execute(interaction) {
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.xpManagerRoles || []).includes(r.id));
        if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });

        await interaction.deferReply({ ephemeral: false });

        const action = interaction.options.getSubcommand();
        const member = interaction.options.getMember("member");
        const amount = interaction.options.getInteger("amount");

        const userFromDb = await findUserByDiscordId(member.id);
        if (!userFromDb) {
            return interaction.editReply({ content: `❌ User <@${member.id}> is not linked to a Roblox account. They need to use \`/verify\` first.` });
        }

        const robloxData = await getRobloxUser(userFromDb.robloxUsername);
        if (!robloxData) return interaction.editReply({ content: "⚠️ Could not find the linked Roblox user. Their username might have changed." });

        const inGroup = await isInRobloxGroup(robloxData.id, config.groupId);
        if (!inGroup) return interaction.editReply({ content: "❌ The linked user is not in the community group." });

        let user = userFromDb;
        const oldExpeditionCount = user.expeditions || 0;
        let newExpeditionCount = oldExpeditionCount;

        if (action === "add") newExpeditionCount += amount;
        if (action === "remove") newExpeditionCount = Math.max(newExpeditionCount - amount, 0);
        if (action === "set") newExpeditionCount = amount;

        user.expeditions = newExpeditionCount;
        await saveUser(user);

        // Kirim pesan sukses DULU
        await interaction.editReply({ content: `✅ ${action} ${amount} Expedition count for **${robloxData.name}** (linked to <@${member.id}>). Total: **${newExpeditionCount}**` });

        // [PERBAIKAN] Kirim log SETELAH pesan sukses
        try {
            const xpLogChannel = interaction.guild.channels.cache.get(config.xpLogChannelId);
            if (xpLogChannel) {
                const logEmbed = new EmbedBuilder().setTitle("🗺️ Expedition Log (Discord Target)").setColor(embedColor)
                    .addFields(
                        { name: "Action", value: action, inline: true }, { name: "Amount", value: amount.toString(), inline: true },
                        { name: "Target Discord", value: `<@${member.id}>`, inline: true }, { name: "Target Roblox", value: `${robloxData.name}`, inline: true },
                        { name: "By", value: interaction.user.tag, inline: true }, { name: "Old Expeditions", value: oldExpeditionCount.toString(), inline: true },
                        { name: "New Expeditions", value: newExpeditionCount.toString(), inline: true }
                    ).setTimestamp();
                await xpLogChannel.send({ embeds: [logEmbed] });
            }
        } catch (logErr) {
            console.error("Failed to send Expedition log:", logErr);
        }

    } catch (error) {
        logError(error, interaction, "expod");
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while processing the expod command." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred while processing the expod command.", ephemeral: true });
        }
    }
}