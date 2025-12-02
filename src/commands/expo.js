import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getRobloxUser, isInRobloxGroup, embedColor } from "../utils/helpers.js";
import { findUser, saveUser } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };

export const data = new SlashCommandBuilder()
    .setName("expo")
    .setDescription("Manage user Expedition count (Admin only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add").setDescription("Add expeditions count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Expedition amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("remove").setDescription("Remove expeditions count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Expedition amount").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("set").setDescription("Set expeditions count")
            .addStringOption(opt => opt.setName("username").setDescription("Roblox username").setRequired(true))
            .addIntegerOption(opt => opt.setName("amount").setDescription("Expedition amount").setRequired(true))
    );

export async function execute(interaction) {
    const allowed =
        interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
        interaction.member.roles.cache.some(r => (config.xpManagerRoles || []).includes(r.id));
    if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });

    const action = interaction.options.getSubcommand();
    const username = interaction.options.getString("username");
    const amount = interaction.options.getInteger("amount");

    await interaction.deferReply({ ephemeral: false });

    const robloxData = await getRobloxUser(username);
    if (!robloxData) return interaction.editReply({ content: "⚠️ Roblox user not found." });

    const inGroup = await isInRobloxGroup(robloxData.id, config.groupId);
    if (!inGroup) return interaction.editReply({ content: "❌ User is not in the community group." });

    let user = await findUser(robloxData.id.toString());
    if (!user) user = { robloxId: robloxData.id.toString(), robloxUsername: robloxData.name, xp: 0, expeditions: 0, achievements: [] };

    const oldExpeditionCount = user.expeditions || 0;
    let newExpeditionCount = oldExpeditionCount;

    if (action === "add") newExpeditionCount += amount;
    if (action === "remove") newExpeditionCount = Math.max(newExpeditionCount - amount, 0);
    if (action === "set") newExpeditionCount = amount;

    user.expeditions = newExpeditionCount;
    await saveUser(user);

    // Log ke channel
    const xpLogChannel = interaction.guild.channels.cache.get(config.xpLogChannelId);
    if (xpLogChannel) {
        const logEmbed = new EmbedBuilder()
            .setTitle("🗺️ Expedition Log (Manual)")
            .setColor(embedColor)
            .addFields(
                { name: "Action", value: action, inline: true },
                { name: "Amount", value: amount.toString(), inline: true },
                { name: "Target", value: `${robloxData.name} (${robloxData.id})`, inline: true },
                { name: "By", value: interaction.user.tag, inline: true },
                { name: "Old Expeditions", value: oldExpeditionCount.toString(), inline: true },
                { name: "New Expeditions", value: newExpeditionCount.toString(), inline: true }
            )
            .setTimestamp();
        xpLogChannel.send({ embeds: [logEmbed] }).catch(() => {});
    }

    return interaction.editReply({ content: `✅ ${action} ${amount} Expedition count for **${robloxData.name}**. Total: **${newExpeditionCount}**` });
}