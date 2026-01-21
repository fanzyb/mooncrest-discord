import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../../utils/modLogger.js";
import { deleteWarningByCaseId } from "../../db/firestore.js"; // <-- Fungsi baru

export const data = new SlashCommandBuilder()
    .setName("unwarn")
    .setDescription("Removes a specific warning from a user by its Case ID.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addStringOption(opt => 
        opt.setName("case_id")
           .setDescription("The Case ID of the warning to remove.")
           .setRequired(true)
    )
    .addStringOption(opt => 
        opt.setName("reason")
           .setDescription("Reason for removing the warning.")
           .setRequired(false)
    );

export async function execute(interaction) {
    const caseId = interaction.options.getString("case_id");
    const reason = interaction.options.getString("reason") || "No reason provided.";
    const moderator = interaction.user;

    await interaction.deferReply({ ephemeral: true });

    try {
        // Panggil fungsi firestore baru
        const deletedWarning = await deleteWarningByCaseId(caseId, interaction.guild.id);

        if (!deletedWarning) {
            return interaction.editReply({ 
                content: `❌ No warning found with Case ID: **${caseId}**.` 
            });
        }

        // Kita butuh data user dari warning yang dihapus untuk log
        const targetUser = await interaction.client.users.fetch(deletedWarning.userId).catch(() => null);
        const logTarget = targetUser || { tag: `User ID: ${deletedWarning.userId}`, id: deletedWarning.userId, displayAvatarURL: () => null };

        // Kirim ke log
        await sendModLog(
            interaction.guild,
            "Warning Removed (Unwarn)",
            "#00FF00", // Hijau
            logTarget,
            moderator,
            reason,
            [
                { name: "Removed Warning (Case ID)", value: deletedWarning.caseId },
                { name: "Original Reason", value: deletedWarning.reason }
            ]
        );

        await interaction.editReply({ 
            content: `✅ Successfully removed warning **${caseId}** from **${logTarget.tag}**.` 
        });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while removing this warning." });
    }
}