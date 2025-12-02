import { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, StringSelectMenuBuilder } from "discord.js";
import { achievementsConfig } from "../utils/helpers.js";
import { findUserByDiscordId } from "../db/firestore.js"; // Ganti findUser dengan ini
import config from "../config.json" with { type: "json" };

export const data = new SlashCommandBuilder()
    .setName("reward")
    .setDescription("Give or remove achievements (interactive)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("add")
            .setDescription("Give an achievement to a user")
            .addUserOption(opt => opt.setName("target").setDescription("The verified Discord user").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("remove")
            .setDescription("Remove an achievement from a user")
            .addUserOption(opt => opt.setName("target").setDescription("The verified Discord user").setRequired(true))
    );

export async function execute(interaction) {
    const allowed =
        interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
        interaction.member.roles.cache.some(r => (config.rewardManagerRoles || []).includes(r.id));
    if (!allowed) return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });

    const sub = interaction.options.getSubcommand();
    const targetMember = interaction.options.getMember("target");

    await interaction.deferReply({ ephemeral: true });

    // Cari data user berdasarkan Discord ID
    const user = await findUserByDiscordId(targetMember.id);

    if (!user || !user.isVerified) {
        return interaction.editReply({ content: `❌ User <@${targetMember.id}> is not linked to a Roblox account. They need to use \`/verify\` first.` });
    }

    // Gunakan ID Discord di customId agar handler bisa memberikan Role nanti
    // Format: reward_add:DISCORD_ID
    const customIdSuffix = targetMember.id; 

    if (sub === "add") {
        const currentAchvIds = user.achievements || [];
        // Tampilkan achievement yang BELUM dimiliki user
        const filteredAchvs = achievementsConfig.filter(a => !currentAchvIds.includes(a.id));

        if (!filteredAchvs.length) {
            return interaction.editReply({ content: `✅ **${user.robloxUsername}** already has all available achievements.` });
        }

        const options = filteredAchvs.map(a => ({
            label: a.name,
            description: a.description || "—",
            value: String(a.id)
        }));

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`reward_add:${customIdSuffix}`)
            .setPlaceholder("Select achievement to add")
            .addOptions(options);
            
        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.editReply({ content: `🎖 Select achievement to give to **${user.robloxUsername}** (<@${targetMember.id}>)`, components: [row] });
    }

    if (sub === "remove") {
        if (!user.achievements || !user.achievements.length) {
            return interaction.editReply({ content: "⚠️ User has no achievements." });
        }

        const options = (user.achievements || [])
            .map(id => achievementsConfig.find(a => a.id === id))
            .filter(Boolean)
            .map(a => ({ label: a.name, description: a.description || "—", value: String(a.id) }));

        if (!options.length) return interaction.editReply({ content: "⚠️ No known achievements to remove for this user." });

        const menu = new StringSelectMenuBuilder()
            .setCustomId(`reward_remove:${customIdSuffix}`)
            .setPlaceholder("Select achievement to remove")
            .addOptions(options);
            
        const row = new ActionRowBuilder().addComponents(menu);
        return interaction.editReply({ content: `🗑 Select achievement to remove from **${user.robloxUsername}** (<@${targetMember.id}>)`, components: [row] });
    }
}