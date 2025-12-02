import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from "discord.js";
import { findUserByDiscordId, findUser, saveUser } from "../db/firestore.js";
import { getRobloxUser, getRobloxUserById, embedColor } from "../utils/helpers.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("updateprofile")
    .setDescription("Force update a user's Roblox profile data (Admin/Mod).")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
    .addStringOption(opt =>
        opt.setName("target")
            .setDescription("Discord User ID, @mention, or Roblox Username.")
            .setRequired(true)
    );

export async function execute(interaction) {
    const commandName = "updateprofile";
    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.ManageNicknames) ||
            interaction.member.roles.cache.some(r => (config.linkManagerRoles || []).includes(r.id));

        if (!allowed) {
            return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });
        }

        await interaction.deferReply();

        const target = interaction.options.getString("target");
        let userDb = null;
        let discordMember = null;

        // 1. Resolve Target
        const discordIdMatch = target.match(/<@!?(\d+)>|^\d{17,19}$/);
        if (discordIdMatch) {
            const discordId = discordIdMatch[1] || target;
            userDb = await findUserByDiscordId(discordId);
            try { discordMember = await interaction.guild.members.fetch(discordId); } catch { }
        } else {
            const robloxData = await getRobloxUser(target);
            if (robloxData) {
                userDb = await findUser(robloxData.id.toString());
                if (userDb && userDb.discordId) {
                    try { discordMember = await interaction.guild.members.fetch(userDb.discordId); } catch { }
                }
            }
        }

        if (!userDb || !userDb.isVerified) {
            return interaction.editReply({ content: `❌ User **${target}** is not verified or not found in the database.` });
        }

        // 2. Fetch Latest Roblox Data
        const latestRobloxData = await getRobloxUserById(userDb.robloxId);
        if (!latestRobloxData) {
            return interaction.editReply({ content: `⚠️ Could not fetch latest data for Roblox ID **${userDb.robloxId}**.` });
        }

        // 3. Update Database
        const oldUsername = userDb.robloxUsername;
        userDb.robloxUsername = latestRobloxData.name;
        // userDb.robloxDisplayName = latestRobloxData.displayName; // If you want to save display name too
        await saveUser(userDb);

        // 4. Update Discord Nickname
        let nicknameStatus = "Skipped (Member not found)";
        if (discordMember) {
            const newNick = `${latestRobloxData.displayName} (@${latestRobloxData.name})`;
            if (discordMember.nickname !== newNick) {
                try {
                    await discordMember.setNickname(newNick);
                    nicknameStatus = "Updated";
                } catch (e) {
                    nicknameStatus = `Failed (${e.message})`;
                }
            } else {
                nicknameStatus = "Already up to date";
            }
        }

        // 5. Response
        const embed = new EmbedBuilder()
            .setTitle("✅ Profile Updated")
            .setColor(embedColor)
            .addFields(
                { name: "Roblox Account", value: `${latestRobloxData.name} (${latestRobloxData.id})`, inline: true },
                { name: "Old Username", value: oldUsername || "N/A", inline: true },
                { name: "Nickname Status", value: nicknameStatus, inline: false }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logError(error, interaction, commandName);
        if (!interaction.replied) await interaction.editReply({ content: "❌ An unexpected error occurred." });
    }
}
