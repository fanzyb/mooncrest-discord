import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("role")
    .setDescription("Add or remove a role from a member.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand(sub =>
        sub.setName("add")
           .setDescription("Add a role to a member.")
           .addUserOption(opt => opt.setName("target").setDescription("The user to manage.").setRequired(true))
           .addRoleOption(opt => opt.setName("role").setDescription("The role to add.").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("remove")
           .setDescription("Remove a role from a member.")
           .addUserOption(opt => opt.setName("target").setDescription("The user to manage.").setRequired(true))
           .addRoleOption(opt => opt.setName("role").setDescription("The role to remove.").setRequired(true))
    );

export async function execute(interaction) {
    const action = interaction.options.getSubcommand();
    const target = interaction.options.getMember("target");
    const role = interaction.options.getRole("role");

    if (!target) {
        return interaction.reply({ content: "User not found.", ephemeral: true });
    }

    // Cek hierarki (Error ini tetap ephemeral)
    if (role.position >= interaction.member.roles.highest.position) {
         return interaction.reply({ content: "❌ You cannot manage a role that is higher than or equal to your own.", ephemeral: true });
    }
    if (role.position >= interaction.guild.members.me.roles.highest.position) {
         return interaction.reply({ content: "❌ I cannot manage this role. It is higher than my own role.", ephemeral: true });
    }

    // --- [PERUBAHAN] Defer diubah menjadi publik (default) ---
    await interaction.deferReply(); 
    // (Sebelumnya: { ephemeral: true })

    try {
        if (action === "add") {
            if (target.roles.cache.has(role.id)) {
                // Pesan info/error tetap ephemeral
                return interaction.editReply({ content: "ℹ️ User already has that role.", ephemeral: true });
            }
            await target.roles.add(role);

            // --- Pesan Sukses (Publik) ---
            await interaction.editReply({ content: `✅ Added **${role.name}** to **${target.user.tag}**.` });
        } 
        else if (action === "remove") {
            if (!target.roles.cache.has(role.id)) {
                 // Pesan info/error tetap ephemeral
                return interaction.editReply({ content: "ℹ️ User does not have that role.", ephemeral: true });
            }
            await target.roles.remove(role);

            // --- Pesan Sukses (Publik) ---
            await interaction.editReply({ content: `✅ Removed **${role.name}** from **${target.user.tag}**.` });
        }
    } catch (err) {
        console.error(err);
        // Pesan error utama tetap ephemeral
        await interaction.editReply({ content: "❌ An error occurred while managing roles.", ephemeral: true });
    }
}