import { SlashCommandBuilder, PermissionFlagsBits, ChannelType } from "discord.js";
import config from "../config.json" with { type: "json" }; //
import { logError } from "../utils/errorLogger.js"; //
// --- [BARU] Import dari handler ---
import { generateControlPanelEmbed } from "../utils/tempVoiceHandler.js";

// --- Fungsi generateControlPanelEmbed() LOKAL DIHAPUS ---

// --- Slash Command ---
export const data = new SlashCommandBuilder()
    .setName("tempvoice")
    .setDescription("Base command for Temp Voice system.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // Hanya Admin
    .addSubcommand(sub =>
        sub.setName("setup_panel")
            .setDescription("Posts the permanent VC control panel.")
            .addChannelOption(opt =>
                opt.setName("channel")
                   .setDescription("The text channel to post the panel in.")
                   .addChannelTypes(ChannelType.GuildText)
                   .setRequired(true)
            )
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();

    if (sub === "setup_panel") {
        const targetChannel = interaction.options.getChannel("channel");

        if (targetChannel.id !== config.tempVoiceControlChannelId) {
            return interaction.reply({ 
                content: `❌ This panel can only be sent to the channel specified in \`config.json\` (<#${config.tempVoiceControlChannelId}>).`, 
                ephemeral: true 
            });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // --- Memanggil fungsi yang di-import ---
            const panel = generateControlPanelEmbed(); 
            await targetChannel.send(panel);
            await interaction.editReply({ content: `✅ Temp Voice control panel sent to ${targetChannel}.` });
        } catch (e) {
            logError(e, interaction, "tempvoice setup_panel");
            await interaction.editReply({ content: "❌ Failed to send panel. Check my permissions." });
        }
    }
}