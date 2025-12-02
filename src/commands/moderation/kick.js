import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { sendModLog } from "../../utils/modLogger.js";

export const data = new SlashCommandBuilder()
    .setName("kick")
    .setDescription("Kicks a member from the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(opt => opt.setName("target").setDescription("The user to kick.").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for the kick.").setRequired(false));

export async function execute(interaction) {
    const target = interaction.options.getMember("target");
    const reason = interaction.options.getString("reason") || "No reason provided.";

    if (!target) {
        return interaction.reply({ content: "User not found. They may have left the server.", ephemeral: true });
    }

    if (!target.kickable) {
        return interaction.reply({ content: "❌ I cannot kick this user. They may have a higher role or I lack permissions.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        const dmEmbed = new EmbedBuilder()
            .setColor("#FFA500")
            .setTitle(`You have been kicked from ${interaction.guild.name}`)
            .addFields({ name: "Reason", value: reason });

        await target.send({ embeds: [dmEmbed] }).catch(() => {
            console.log(`[Kick] Could not DM user ${target.user.tag}.`);
        });

        await target.kick(reason);

        await sendModLog(
            interaction.guild,
            "User Kicked",
            "#FFA500",
            target.user,
            interaction.user,
            reason
        );

        await interaction.editReply({ content: `✅ Successfully kicked **${target.user.tag}**.` });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while kicking this user." });
    }
}