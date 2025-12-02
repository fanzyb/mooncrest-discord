import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { getRobloxUser, getRobloxAvatar, getLevel, embedColor, achievementsConfig, getRoverVerification, performVerification } from "../utils/helpers.js";
import { findUser, saveUser, countUsersWhere, findUserByDiscordId } from "../db/firestore.js";
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Check your rank or someone else's.")
    .addStringOption(opt =>
        opt.setName("target")
            .setDescription("Roblox username, Discord user, or Discord ID (optional).")
            .setRequired(false)
    );

export async function execute(interaction) {
    try {
        await interaction.deferReply();

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

        if (!robloxInfo) {
            const targetMember = target ? `**${target}** is` : "You are";
            return interaction.editReply({ content: `❌ ${targetMember} not verified with this bot or RoVer in this server.` });
        }

        let userFromDb = await findUser(robloxInfo.robloxId);

        if (!userFromDb && discordIdToSearch) {
            const robloxApiDataForNewUser = await getRobloxUser(robloxInfo.robloxUsername);
            if (!robloxApiDataForNewUser) {
                return interaction.editReply({ content: `⚠️ Could not fetch data for Roblox user **${robloxInfo.robloxUsername}**.` });
            }

            userFromDb = {
                robloxId: robloxInfo.robloxId,
                robloxUsername: robloxApiDataForNewUser.name,
                discordId: discordIdToSearch,
                isVerified: true,
                xp: 0,
                expeditions: 0,
                achievements: []
            };

            await saveUser(userFromDb);

            try {
                const member = await interaction.guild.members.fetch(discordIdToSearch);
                await performVerification(member, robloxApiDataForNewUser); // <-- [FIX] Menghapus config
            } catch (e) {
                console.warn(`[WARN] Could not apply role/nickname during auto-link for ${discordIdToSearch}: ${e.message}`);
            }

        } else if (!userFromDb) {
            userFromDb = {
                robloxId: robloxInfo.robloxId,
                robloxUsername: (await getRobloxUser(robloxInfo.robloxId)).name,
                xp: 0, expeditions: 0, achievements: []
            };
        }

        const robloxDataFromApi = await getRobloxUser(userFromDb.robloxUsername);
        if (!robloxDataFromApi) {
            return interaction.editReply({ content: `⚠️ Could not fetch data for Roblox user **${userFromDb.robloxUsername}**. Their username might have changed.` });
        }

        const rank = (await countUsersWhere('xp', '>', userFromDb.xp || 0)) + 1;
        const avatar = await getRobloxAvatar(robloxDataFromApi.id);
        const { levelName, bar, progressPercent, xpNeededText } = getLevel(userFromDb.xp);

        const achvs = (userFromDb.achievements || [])
            .map(id => achievementsConfig.find(a => a.id === id)?.name)
            .filter(Boolean)
            .join("\n") || "— None —";



        const embed = new EmbedBuilder()
            .setTitle(`${robloxDataFromApi.displayName} (@${robloxDataFromApi.name})`)
            .setURL(`https://www.roblox.com/users/${robloxDataFromApi.id}/profile`)
            .setThumbnail(avatar || null)
            .setColor(embedColor)
            .addFields(
                { name: "Global Rank (Lunar Points)", value: `#${rank}`, inline: true }, // <-- [GANTI]
                { name: "Level", value: levelName, inline: true },
                { name: "Lunar Points", value: String(userFromDb.xp), inline: true }, // <-- [GANTI]
                { name: "Expeditions", value: String(userFromDb.expeditions || 0), inline: true },

                { name: "Progress", value: `${bar} (${progressPercent}%)`, inline: false },
                { name: "Next Level", value: xpNeededText, inline: false },
                { name: "🏅 Achievements", value: achvs, inline: false }
            )
            .setTimestamp();

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setLabel("View Full Profile")
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://leaderboard.mooncrest.my.id/profile.html?id=${userFromDb.robloxId}`)
            );

        return interaction.editReply({ embeds: [embed], components: [row] });

    } catch (error) {
        logError(error, interaction, "rank");
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while processing the rank command." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred while processing the rank command.", flags: 64 });
        }
    }
}