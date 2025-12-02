import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Displays detailed information about a user.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(opt => opt.setName("target").setDescription("The user to get info about.").setRequired(true));

export async function execute(interaction) {
    const member = interaction.options.getMember("target");

    if (!member) {
        return interaction.reply({ content: "User not found.", ephemeral: true });
    }

    await interaction.deferReply({ ephemeral: true });

    const roles = member.roles.cache
        .sort((a, b) => b.position - a.position)
        .map(r => r)
        .join(", ");
    const roleList = roles.length > 1024 ? "Too many roles to display." : roles;

    const embed = new EmbedBuilder()
        .setColor(member.displayHexColor || "#FFFFFF")
        .setTitle(`User Info: ${member.user.tag}`)
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: "Username", value: member.user.username, inline: true },
            { name: "User ID", value: member.id, inline: true },
            { name: "Bot Account", value: member.user.bot ? "Yes" : "No", inline: true },
            { name: "Joined Server", value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
            { name: "Account Created", value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: "Highest Role", value: `${member.roles.highest}`, inline: true },
            { name: "Roles", value: roleList || "None", inline: false }
        )
        .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
}