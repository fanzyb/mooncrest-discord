import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { getWarnings } from "../../db/firestore.js";

export const data = new SlashCommandBuilder()
    .setName("history")
    .setDescription("Checks the moderation history (warnings) of a user.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName("target").setDescription("The user to check.").setRequired(true));

export async function execute(interaction) {
    const target = interaction.options.getUser("target");

    await interaction.deferReply({ ephemeral: true });

    try {
        const warnings = await getWarnings(target.id, interaction.guild.id);

        if (warnings.length === 0) {
            return interaction.editReply({ content: `✅ **${target.tag}** has a clean record (no warnings found).` });
        }

        const embed = new EmbedBuilder()
            .setColor("#FFFF00")
            .setTitle(`Moderation History for ${target.tag}`)
            .setThumbnail(target.displayAvatarURL())
            .setTimestamp();

        let description = `Found **${warnings.length}** warning(s):\n\n`;

        for (const warn of warnings) {
            const mod = await interaction.guild.members.fetch(warn.moderatorId).catch(() => null);
            const modTag = mod ? mod.user.tag : `ID: ${warn.moderatorId}`;
            const timestamp = warn.timestamp ? `<t:${warn.timestamp.seconds}:R>` : "Unknown date";

            description += `**Case ID:** ${warn.caseId} (${timestamp})\n`;
            description += `**Moderator:** ${modTag}\n`;
            description += `**Reason:** ${warn.reason}\n\n`;
        }

        embed.setDescription(description);

        await interaction.editReply({ embeds: [embed] });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while fetching user history." });
    }
}