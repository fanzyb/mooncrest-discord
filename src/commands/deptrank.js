import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import {
    getRobloxUser,
    getRobloxAvatar,
    embedColor,
    getRoverVerification,
    getGuideLevel,
    getSarLevel
} from "../utils/helpers.js";
import { findUser, findUserByDiscordId } from "../db/firestore.js";
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("deptrank")
    .setDescription("Check your department rank (Guide/SAR) or someone else's.")
    .addStringOption(opt =>
        opt.setName("target")
            .setDescription("Roblox username, Discord user, or Discord ID (optional).")
            .setRequired(false)
    );

export async function execute(interaction) {
    const commandName = "deptrank";
    try {
        await interaction.deferReply();

        // --- Logika Cek User (dari /rank) ---
        const target = interaction.options.getString("target");
        let robloxIdToSearch = null;
        let discordIdToSearch = interaction.user.id;
        const guildId = interaction.guild.id;

        if (target) {
            const discordIdMatch = target.match(/<@!?(\d+)>|^\d{17,19}$/);
            if (discordIdMatch) {
                discordIdToSearch = discordIdMatch[1] || target;
            } else {
                const robloxData = await getRobloxUser(target);
                if (!robloxData) {
                    return interaction.editReply({ content: `⚠️ Roblox user **${target}** not found.` });
                }
                robloxIdToSearch = robloxData.id.toString();
                discordIdToSearch = null;
            }
        }

        let robloxInfo = null;
        if (robloxIdToSearch) {
            robloxInfo = { robloxId: robloxIdToSearch };
        } else if (discordIdToSearch) {
            const userInDb = await findUserByDiscordId(discordIdToSearch);
            if (userInDb) {
                robloxInfo = { robloxId: userInDb.robloxId, robloxUsername: userInDb.robloxUsername };
            } else {
                const userInRover = await getRoverVerification(discordIdToSearch, guildId);
                if (userInRover) {
                    robloxInfo = userInRover;
                }
            }
        }

        // [PERBAIKAN] Cek robloxInfo DAN robloxInfo.robloxId
        if (!robloxInfo || !robloxInfo.robloxId) {
            const targetMember = target ? `**${target}** is` : "You are";
            return interaction.editReply({ content: `❌ ${targetMember} not verified with this bot or RoVer in this server.` });
        }

        // Panggilan ini sekarang aman karena robloxInfo.robloxId dijamin ada
        let userFromDb = await findUser(robloxInfo.robloxId);
        if (!userFromDb) {
            userFromDb = {
                robloxId: robloxInfo.robloxId,
                robloxUsername: (await getRobloxUser(robloxInfo.robloxId))?.name || "Unknown",
                xp: 0, expeditions: 0, guidePoints: 0, sarPoints: 0, achievements: []
            };
        }

        const robloxDataFromApi = await getRobloxUser(userFromDb.robloxUsername);
        if (!robloxDataFromApi) {
            return interaction.editReply({ content: `⚠️ Could not fetch data for Roblox user **${userFromDb.robloxUsername}**. Their username might have changed.` });
        }
        // --- Akhir Logika Cek User ---

        const avatar = await getRobloxAvatar(robloxDataFromApi.id);

        // Ambil rank dan poin
        const guidePoints = userFromDb.guidePoints || 0;
        const sarPoints = userFromDb.sarPoints || 0;
        const guideRank = getGuideLevel(guidePoints).levelName;
        const sarRank = getSarLevel(sarPoints).levelName;

        const embed = new EmbedBuilder()
            .setTitle(`Department Ranks for ${robloxDataFromApi.displayName} (@${robloxDataFromApi.name})`)
            .setURL(`https://www.roblox.com/users/${robloxDataFromApi.id}/profile`)
            .setThumbnail(avatar || null)
            .setColor(embedColor)
            .addFields(
                {
                    name: "🧭 Guide Department",
                    value: (guidePoints > 0) ? `**Rank:** ${guideRank}\n**Points:** ${guidePoints}` : "N/A",
                    inline: true
                },
                {
                    name: "⛑️ SAR Department",
                    value: (sarPoints > 0) ? `**Rank:** ${sarRank}\n**Points:** ${sarPoints}` : "N/A",
                    inline: true
                }
            );

        return interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while processing the deptrank command." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}