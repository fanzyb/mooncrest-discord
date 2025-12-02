import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ButtonBuilder, ButtonStyle } from "discord.js";
import {
    getRobloxUser,
    isInRobloxGroup,
    performVerification,
    embedColor,
    syncRankRole
} from "../utils/helpers.js";
import { findUser, saveUser, findUserByDiscordId } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { logError } from "../utils/errorLogger.js";

// --- Panel Generator (Dengan Embed Lengkap) ---
export function generateVerificationPanel(type, data = {}) {
    // --- Panel untuk /link initiate (Admin Pre-filled) ---
    if (type === 'initiate') {
        const { username, robloxId, robloxAvatar, initiatorTag } = data;

        const embed = new EmbedBuilder()
            .setTitle("🔗 Account Linking Verification")
            .setDescription(
                `Admin/Manager **${initiatorTag}** has initiated a linking request for Roblox user: **${username}**.\n\n` +
                "**Instructions**:\n" +
                "If you are the owner of this Roblox account, **click the button below** to link your Discord account. You **must be in the community Roblox group** to verify."
            )
            .addFields({
                name: "Roblox ID",
                value: String(robloxId),
                inline: true
            })
            .setThumbnail(robloxAvatar || null)
            .setColor(embedColor)
            .setFooter({ text: `Attention: Verification is required for Roblox user ${username}.` })
            .setTimestamp();

        const button = new ButtonBuilder()
            .setCustomId(`verify_initiate:${encodeURIComponent(username)}`)
            .setLabel(`Click to Link to ${username}`)
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder().addComponents(button);

        return {
            content: `❗ **Attention:** Verification is required for Roblox user **${username}** initiated by ${initiatorTag}.`,
            embeds: [embed],
            components: [row]
        };
    }

    // --- Panel untuk /link setup (Public) ---
    const embed = new EmbedBuilder()
        .setTitle("🛡️ Roblox Verification Panel")
        .setDescription(
            "Welcome! To get full access to our Discord server and the XP system, you must link your Discord account with your Roblox account."
        )
        .addFields({
            name: "Instructions:",
            value:
                `1. Ensure you have joined our community Roblox Group (Link: [Join Here](https://www.roblox.com/groups/${config.groupId})).\n` +
                "2. Click the **Link Roblox Account** button below.\n" +
                "3. Enter your Roblox Username in the pop-up modal.\n" +
                "4. The system will automatically verify and grant you a role if successful."
        })
        .setFooter({ text: "This verification is required to track XP and grant rewards!" })
        .setColor(embedColor)
        .setImage("https://cdn.discordapp.com/attachments/1435964396408148088/1435967416264949811/VERIFY.png?ex=690de45f&is=690c92df&hm=f8ed08710d5cd14854d4a064ccb4196d6f153c47fd4b85866db350403fd64fac")
        .setTimestamp();

    const button = new ButtonBuilder()
        .setCustomId("verify_modal")
        .setLabel("Link Roblox Account")
        .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    return { embeds: [embed], components: [row] };
}


// --- SLASH COMMAND /verify ---
export const data = new SlashCommandBuilder()
    .setName("verify")
    .setDescription("Start the verification process to link your Roblox account.")
    .addStringOption(option =>
        option.setName("username")
            .setDescription("Your Roblox username or display name.")
            .setRequired(false)
    );

export async function execute(interaction) {
    const commandName = 'verify';
    try {
        const username = interaction.options.getString("username");

        if (username) {
            return handleVerification(interaction, username);
        }

        const modal = new ModalBuilder()
            .setCustomId('verify_modal_submit')
            .setTitle('Roblox Verification');

        const usernameInput = new TextInputBuilder()
            .setCustomId('roblox_username')
            .setLabel("What is your Roblox Username?")
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('e.g., Builderman')
            .setRequired(true);

        const row = new ActionRowBuilder().addComponents(usernameInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    } catch (error) {
        logError(error, interaction, commandName);
    }
}

// --- FUNGSI UTAMA VERIFIKASI ---
export async function handleVerification(interaction, usernameInput, discordId = null) {
    const commandName = 'handleVerification';
    try {
        const member = interaction.member;
        const discordUserID = discordId || member.id;
        const isEphemeral = true;

        const existingUser = await findUserByDiscordId(discordUserID);
        if (existingUser && existingUser.isVerified) {
            return interaction.reply({ content: `✅ **Verification successful!** Your account is already linked to the Roblox user **${existingUser.robloxUsername}**.`, ephemeral: isEphemeral });
        }

        await interaction.deferReply({ ephemeral: isEphemeral });

        const robloxData = await getRobloxUser(usernameInput);
        if (!robloxData) {
            return interaction.editReply({ content: "⚠️ Roblox user not found. Please check the spelling and try again." });
        }

        const linkedUser = await findUser(robloxData.id.toString());
        if (linkedUser && linkedUser.discordId && linkedUser.discordId !== discordUserID) {
            return interaction.editReply({ content: "❌ This Roblox account is already linked to another Discord user." });
        }

        let verificationResult;
        try {
            // Panggil tanpa 'config'
            verificationResult = await performVerification(member, robloxData);
        } catch (error) {
            if (error.message === "NOT_IN_GROUP") {
                const groupURL = `https://www.roblox.com/groups/${config.groupId}`;
                const embed = new EmbedBuilder()
                    .setTitle("❌ Verification Failed: Group Membership Required")
                    .setColor("#FF0000")
                    .setDescription(`To verify, you must be a member of our Roblox group.\n\n**Please join the group and try again.**`)
                    .addFields({ name: "Group Link", value: `[Click here to join](${groupURL})` });
                return interaction.editReply({ embeds: [embed] });
            }
            throw error;
        }

        const userData = {
            robloxId: robloxData.id.toString(),
            robloxUsername: robloxData.name,
            discordId: discordUserID,
            isVerified: true,
            xp: linkedUser?.xp || 0,
            expeditions: linkedUser?.expeditions || 0,
            achievements: linkedUser?.achievements || [],
        };
        await saveUser(userData);

        const rankRole = await syncRankRole(member, userData.xp);

        let replyMessage = `🎉 **Verification Complete!** Your account has been linked to **${robloxData.displayName} (@${robloxData.name})**.`;
        if (verificationResult.nicknameWarning) {
            replyMessage += `\n\n${verificationResult.nicknameWarning}`;
        } else {
            replyMessage += ` Your nickname has been set to \`${verificationResult.newNickname}\`.`;
        }

        if (rankRole) {
            replyMessage += `\n👑 Your rank role **${rankRole.name}** has been applied!`;
        }

        // ... (LOGGING) ...

        return interaction.editReply({ content: replyMessage, ephemeral: isEphemeral });

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred during verification." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred during verification.", ephemeral: true });
        }
    }
}

// --- HANDLE MODAL SUBMISSION and BUTTONS ---
export async function handleComponent(interaction) {
    const customId = interaction.customId;
    const commandName = 'verify:handleComponent';
    try {
        if (customId === 'verify_modal' || customId.startsWith('verify_initiate:')) {
            let username = '';
            if (customId.startsWith('verify_initiate:')) {
                username = decodeURIComponent(customId.split(':')[1]);
            }

            const modal = new ModalBuilder()
                .setCustomId('verify_modal_submit')
                .setTitle('Roblox Verification');

            const usernameInput = new TextInputBuilder()
                .setCustomId('roblox_username')
                .setLabel("What is your Roblox Username?")
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('e.g., Builderman')
                .setValue(username)
                .setRequired(true);

            const row = new ActionRowBuilder().addComponents(usernameInput);
            modal.addComponents(row);
            await interaction.showModal(modal);
        }
    } catch (error) {
        logError(error, interaction, commandName);
    }
}

export async function handleModalSubmit(interaction) {
    if (interaction.customId === 'verify_modal_submit') {
        const username = interaction.fields.getTextInputValue('roblox_username');
        return handleVerification(interaction, username);
    }
}
