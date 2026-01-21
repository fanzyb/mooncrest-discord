import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { sendModLog } from "../../utils/modLogger.js";

export const data = new SlashCommandBuilder()
    .setName("unban")
    .setDescription("Unbans a user from the server.")
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addStringOption(opt => opt.setName("user_id").setDescription("The ID of the user to unban.").setRequired(true))
    .addStringOption(opt => opt.setName("reason").setDescription("Reason for the unban.").setRequired(false));

export async function execute(interaction) {
    const userId = interaction.options.getString("user_id");
    const reason = interaction.options.getString("reason") || "No reason provided.";

    await interaction.deferReply({ ephemeral: true });

    try {
        const banList = await interaction.guild.bans.fetch();
        const bannedUser = banList.get(userId);

        if (!bannedUser) {
            return interaction.editReply({ content: "❌ This user ID is not on the ban list.", ephemeral: true });
        }

        await interaction.guild.bans.remove(userId, reason);

        await sendModLog(
            interaction.guild,
            "User Unbanned",
            "#00FF00",
            bannedUser.user,
            interaction.user,
            reason
        );

        await interaction.editReply({ content: `✅ Successfully unbanned **${bannedUser.user.tag}**.` });

    } catch (err) {
        console.error(err);
        await interaction.editReply({ content: "❌ An error occurred while unbanning this user." });
    }
}