import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { sendModLog } from "../../utils/modLogger.js";

export const data = new SlashCommandBuilder()
    .setName("ban")
    .setDescription("Bans a member from the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(opt => opt.setName("target").setDescription("The user to ban.").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for the ban.").setRequired(false))
    .addStringOption(opt => 
        opt.setName("delete_messages")
           .setDescription("How much message history to delete.")
           .addChoices(
               { name: "Don't delete any", value: "0" },
               { name: "Last 1 hour", value: "3600" },
               { name: "Last 24 hours", value: "86400" },
               { name: "Last 7 days", value: "604800" }
           )
           .setRequired(false)
    );

export async function execute(interaction) {
    const target = interaction.options.getMember("target");
    const reason = interaction.options.getString("reason") || "No reason provided.";
    const deleteSeconds = parseInt(interaction.options.getString("delete_messages") || "0");

    if (!target) {
        return interaction.reply({ content: "User not found. They may have left the server.", ephemeral: true });
    }

    if (!target.bannable) {
        return interaction.reply({ content: "❌ I cannot ban this user. They may have a higher role or I lack permissions.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const dmEmbed = new EmbedBuilder()
            .setColor("#FF0000")
            .setTitle(`You have been banned from ${interaction.guild.name}`)
            .addFields({ name: "Reason", value: reason });

        await target.send({ embeds: [dmEmbed] }).catch(() => {
            console.log(`[Ban] Could not DM user ${target.user.tag}.`);
        });

        await target.ban({ reason: reason, deleteMessageSeconds: deleteSeconds });

        await sendModLog(
            interaction.guild,
            "User Banned",
            "#FF0000",
            target.user,
            interaction.user,
            reason
        );

        await interaction.editReply({ content: `✅ Successfully banned **${target.user.tag}**.` });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while banning this user." });
    }
}