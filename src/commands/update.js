import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
import { findUserByDiscordId, saveUser } from "../db/firestore.js";
import { getRobloxUser, getRobloxUserById, embedColor } from "../utils/helpers.js";
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("update")
    .setDescription("Update your verified Roblox profile data and nickname.");

export async function execute(interaction) {
    const commandName = "update";
    try {
        await interaction.deferReply({ ephemeral: true });

        const member = interaction.member;
        const userDb = await findUserByDiscordId(member.id);

        if (!userDb || !userDb.isVerified) {
            return interaction.editReply({ content: "❌ You are not verified! Use `/verify` first." });
        }

        // 1. Fetch Latest Roblox Data
        const latestRobloxData = await getRobloxUserById(userDb.robloxId);
        if (!latestRobloxData) {
            return interaction.editReply({ content: `⚠️ Could not fetch latest data for your Roblox ID (**${userDb.robloxId}**).` });
        }

        // 2. Update Database
        const oldUsername = userDb.robloxUsername;
        userDb.robloxUsername = latestRobloxData.name;
        await saveUser(userDb);

        // 3. Update Discord Nickname
        let nicknameStatus = "Skipped";
        const newNick = `${latestRobloxData.displayName} (@${latestRobloxData.name})`;

        if (member.nickname !== newNick) {
            try {
                await member.setNickname(newNick);
                nicknameStatus = "Updated";
            } catch (e) {
                nicknameStatus = `Failed (I might lack permissions)`;
            }
        } else {
            nicknameStatus = "Already up to date";
        }

        // 4. Response
        const embed = new EmbedBuilder()
            .setTitle("✅ Profile Updated")
            .setColor(embedColor)
            .setDescription(`Successfully updated your profile data linked to **${latestRobloxData.name}**.`)
            .addFields(
                { name: "Nickname Status", value: nicknameStatus, inline: true }
            )
            .setTimestamp();

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        logError(error, interaction, commandName);
        if (!interaction.replied) await interaction.editReply({ content: "❌ An unexpected error occurred." });
    }
}
