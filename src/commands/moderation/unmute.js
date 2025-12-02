import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../../utils/modLogger.js";

export const data = new SlashCommandBuilder()
    .setName("unmute")
    .setDescription("Removes a mute (timeout) from a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName("target").setDescription("The user to unmute.").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for the unmute.").setRequired(false));

export async function execute(interaction) {
    const target = interaction.options.getMember("target");
    const reason = interaction.options.getString("reason") || "No reason provided.";

    if (!target) {
        return interaction.reply({ content: "User not found.", ephemeral: true });
    }

    if (!target.moderatable) {
        return interaction.reply({ content: "❌ I cannot unmute this user. They may have a higher role or I lack permissions.", ephemeral: true });
    }

    if (!target.isCommunicationDisabled()) {
        return interaction.reply({ content: "ℹ️ This user is not muted.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    try {
        await target.timeout(null, reason); // null removes timeout

        await sendModLog(
            interaction.guild,
            "User Unmuted",
            "#00FF00",
            target.user,
            interaction.user,
            reason
        );

        await interaction.editReply({ content: `✅ Successfully unmuted **${target.user.tag}**.` });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while unmuting this user." });
    }
}