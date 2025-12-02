import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { sendModLog } from "../../utils/modLogger.js";
import { saveWarning } from "../../db/firestore.js";
import { randomUUID } from "crypto";

export const data = new SlashCommandBuilder()
    .setName("warn")
    .setDescription("Warns a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName("target").setDescription("The user to warn.").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for the warning.").setRequired(true));

export async function execute(interaction) {
    const target = interaction.options.getMember("target");
    const reason = interaction.options.getString("reason");
    const moderator = interaction.user;

    if (!target) {
        return interaction.reply({ content: "User not found.", ephemeral: true });
    }

    if (target.id === moderator.id) {
        return interaction.reply({ content: "❌ You cannot warn yourself.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });
    const caseId = randomUUID().substring(0, 8); // ID unik

    try {
        const dmEmbed = new EmbedBuilder()
            .setColor("#FFD700")
            .setTitle(`You have received a warning in ${interaction.guild.name}`)
            .addFields(
                { name: "Reason", value: reason },
                { name: "Moderator", value: moderator.tag }
            );

        await target.send({ embeds: [dmEmbed] }).catch(() => {
            console.log(`[Warn] Could not DM user ${target.user.tag}.`);
        });

        // Simpan ke Firestore
        await saveWarning(target.id, interaction.guild.id, moderator.id, reason, caseId);

        // Kirim ke log
        await sendModLog(
            interaction.guild,
            "User Warned",
            "#FFD700",
            target.user,
            moderator,
            reason,
            [{ name: "Case ID", value: caseId }]
        );

        await interaction.editReply({ content: `✅ Successfully warned **${target.user.tag}** (Case ID: ${caseId}).` });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while warning this user." });
    }
}