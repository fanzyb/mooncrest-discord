import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ChannelType } from "discord.js";
import { logError } from "../utils/errorLogger.js"; //
import fs from "fs";
import path from "path";

// Tentukan path ke self-roles.json
const rolesFilePath = path.join(process.cwd(), 'self-roles.json');

export const data = new SlashCommandBuilder()
    .setName("selfrole")
    .setDescription("Manage the self-role panels.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("setup")
            .setDescription("Post the self-role embed in this channel.")
            .addChannelOption(opt => 
                opt.setName("channel")
                   .setDescription("The channel to post the panel in.")
                   .addChannelTypes(ChannelType.GuildText)
                   .setRequired(true)
            )
    );

export async function execute(interaction) {
    if (interaction.options.getSubcommand() !== 'setup') return;

    await interaction.deferReply({ flags: 64 }); // Ephemeral

    let selfRolesData;
    try {
        // Baca file JSON kustom kita
        const rawData = fs.readFileSync(rolesFilePath, 'utf8');
        selfRolesData = JSON.parse(rawData);
    } catch (e) {
        logError(e, interaction, "selfrole setup - read file");
        return interaction.editReply({ content: "❌ Error reading `self-roles.json`. Make sure the file exists in the root folder." });
    }

    const targetChannel = interaction.options.getChannel("channel");
    const components = [];

    // Buat dropdown menu untuk setiap kategori di JSON
    for (let i = 0; i < selfRolesData.length; i++) {
        const menuConfig = selfRolesData[i];

        const options = menuConfig.roles.map(role => ({
            label: role.label,
            description: role.description || `Get the ${role.label} role.`,
            value: role.roleId, // Value-nya adalah ID Role
            emoji: role.emoji || undefined
        }));

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId(`selfrole_menu_${i}`) // Custom ID unik berdasarkan index
            .setPlaceholder(menuConfig.menuPlaceholder || "Select roles...")
            .setMinValues(0) // Boleh tidak memilih apa-apa
            .setMaxValues(menuConfig.maxSelect || menuConfig.roles.length) // Multi-select
            .addOptions(options);

        components.push(new ActionRowBuilder().addComponents(selectMenu));
    }

    if (components.length === 0) {
        return interaction.editReply({ content: "ℹ️ `self-roles.json` is empty. No panels were created." });
    }

    // Buat embed utama
    const embed = new EmbedBuilder()
        .setTitle("Take Your Roles")
        .setDescription("Select the roles you'd like to have from the menus below. You can select multiple roles.")
        .setColor("#1B1464") // Discord Blurple
        .setImage("https://cdn.discordapp.com/attachments/1435964396408148088/1435964468910755892/SELF_ROLES.png?ex=69112d60&is=690fdbe0&hm=43253c59ef5b004213d30de0034c7c753d434f98e93ff2a4c5830e954bf121d6&"); // <-- Ganti ini jika perlu

    try {
        await targetChannel.send({ embeds: [embed], components: components });
        await interaction.editReply({ content: `✅ Self-role panel successfully posted in ${targetChannel}!` });
    } catch (e) {
        logError(e, interaction, "selfrole setup - send message");
        await interaction.editReply({ content: "❌ Failed to send panel. Check my permissions in that channel." });
    }
}