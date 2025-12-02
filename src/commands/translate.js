import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";
import { saveTranslationChannel, deleteTranslationChannel, getTranslationChannel } from "../db/firestore.js";

export const data = new SlashCommandBuilder()
    .setName("translate")
    .setDescription("Manage real-time translation for this channel.")
    .addStringOption(option =>
        option.setName("source")
            .setDescription("Source language code (e.g., 'en', 'id') or 'stop' to disable.")
            .setRequired(true)
    )
    .addStringOption(option =>
        option.setName("target")
            .setDescription("Target language code (e.g., 'id', 'en'). Required if starting.")
            .setRequired(false)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels);

export async function execute(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const source = interaction.options.getString("source").toLowerCase();
    const target = interaction.options.getString("target")?.toLowerCase();
    const channelId = interaction.channelId;

    try {
        if (source === "stop" || source === "off") {
            const existing = await getTranslationChannel(channelId);
            if (!existing) {
                return interaction.editReply("❌ Translation is not active in this channel.");
            }
            await deleteTranslationChannel(channelId);
            if (interaction.client.translationChannels) interaction.client.translationChannels.delete(channelId);
            return interaction.editReply("✅ Real-time translation **STOPPED** for this channel.");
        }

        if (!target) {
            return interaction.editReply("❌ You must provide a target language. Example: `/translate en id`");
        }

        // Save/Update
        const data = {
            sourceLang: source,
            targetLang: target,
            active: true,
            updatedAt: Date.now(),
            updatedBy: interaction.user.id
        };
        await saveTranslationChannel(channelId, data);

        // Update Cache
        if (!interaction.client.translationChannels) interaction.client.translationChannels = new Map();
        interaction.client.translationChannels.set(channelId, data);

        return interaction.editReply(`✅ Real-time translation **STARTED**.\nMessages will be translated between **${source.toUpperCase()}** and **${target.toUpperCase()}**.`);

    } catch (error) {
        console.error("[Translate Command Error]", error);
        return interaction.editReply("❌ An error occurred while saving settings.");
    }
}
