import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ChannelType } from "discord.js";
// Import dari lokasi yang benar
import { 
    getRobloxUser, 
    getRobloxAvatar, 
    performVerification, 
    removeVerification, 
    embedColor,
    syncRankRole
} from "../utils/helpers.js";
import { findUser, saveUser, findUserByDiscordId } from "../db/firestore.js";
import config from "../config.json" with { type: "json" };
import { generateVerificationPanel } from "./verify.js";
import { logError } from "../utils/errorLogger.js";

export const data = new SlashCommandBuilder()
    .setName("link")
    .setDescription("Administrative commands for account linking and verification management.")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName("member").setDescription("Manually link a Discord member to a Roblox account.")
            .addUserOption(opt => opt.setName("discord_member").setDescription("Discord member to link.").setRequired(true))
            .addStringOption(opt => opt.setName("roblox_username").setDescription("Roblox username to link to.").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("status").setDescription("Check the linked status of a member or Roblox user.")
            .addStringOption(opt => opt.setName("identifier").setDescription("Discord User ID, @mention, or Roblox Username.").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("remove").setDescription("Remove the link/verification status from a Discord member.")
            .addUserOption(opt => opt.setName("discord_member").setDescription("Discord member to unlink.").setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("setup").setDescription("Post the public verification panel to a specified channel.")
            .addChannelOption(opt => opt.setName("channel").setDescription("The channel to post the verification panel in.").addChannelTypes(ChannelType.GuildText).setRequired(true))
    )
    .addSubcommand(sub =>
        sub.setName("initiate").setDescription("Post a verification panel pre-filled with a specific Roblox username.")
            .addStringOption(opt => opt.setName("roblox_username").setDescription("Roblox username to pre-fill.").setRequired(true))
    );

export async function execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const commandName = `link ${sub}`;

    try {
        const allowed =
            interaction.member.permissions.has(PermissionFlagsBits.Administrator) ||
            interaction.member.roles.cache.some(r => (config.linkManagerRoles || []).includes(r.id));
        if (!allowed) {
            return interaction.reply({ content: "❌ You do not have permission to use this command.", ephemeral: true });
        }

        const sendLog = (title, color, fields) => {
            const logChannel = interaction.guild.channels.cache.get(config.verificationLogChannelId);
            if (logChannel) {
                const logEmbed = new EmbedBuilder()
                    .setTitle(title).setColor(color).addFields(fields)
                    .addFields({ name: "Admin/Mod", value: interaction.user.tag, inline: false })
                    .setTimestamp();
                logChannel.send({ embeds: [logEmbed] }).catch(e => console.error("Failed to send admin verification log:", e));
            }
        };

        // --- /link member ---
        if (sub === "member") {
            const member = interaction.options.getMember("discord_member");
            const username = interaction.options.getString("roblox_username");
            await interaction.deferReply({ ephemeral: false });

            const robloxData = await getRobloxUser(username);
            if (!robloxData) return interaction.editReply({ content: `⚠️ Roblox user **${username}** not found.` });

            const existingDiscordLink = await findUserByDiscordId(member.id);
            if (existingDiscordLink) return interaction.editReply({ content: `❌ This Discord account is already linked to **${existingDiscordLink.robloxUsername}**.` });

            const existingRobloxLink = await findUser(robloxData.id.toString());
            if (existingRobloxLink && existingRobloxLink.discordId) return interaction.editReply({ content: `❌ This Roblox account is already linked to another Discord user (<@${existingRobloxLink.discordId}>).` });

            let verificationResult;
            try {
                // Panggil tanpa 'config'
                verificationResult = await performVerification(member, robloxData);
            } catch (error) {
                if (error.message === "NOT_IN_GROUP") {
                    const groupURL = `https://www.roblox.com/groups/${config.groupId}`;
                    return interaction.editReply({ content: `❌ **Manual Link Failed:** The user **${robloxData.name}** is not in the Roblox group. Ask them to join first: ${groupURL}` });
                }
                throw error;
            }

            const userData = {
                robloxId: robloxData.id.toString(),
                robloxUsername: robloxData.name,
                discordId: member.id,
                isVerified: true,
                xp: existingRobloxLink?.xp || 0,
                expeditions: existingRobloxLink?.expeditions || 0,
                achievements: existingRobloxLink?.achievements || [],
            };
            await saveUser(userData);
            
            const rankRole = await syncRankRole(member, userData.xp);

            let replyMessage = `✅ Successfully linked <@${member.id}> to **${robloxData.name}**.`;
            if (verificationResult.nicknameWarning) {
                const warning = verificationResult.nicknameWarning.replace("your", "their");
                replyMessage += `\n\n${warning}`;
            }

            if (rankRole) {
                replyMessage += `\n👑 Their rank role **${rankRole.name}** has been applied!`;
            }

            sendLog("✅ Manual Verification Log", "#00FF00", [
                { name: "Discord User", value: `<@${member.id}> (${member.user.tag})` },
                { name: "Roblox Account", value: `${robloxData.name} (${robloxData.id})` }
            ]);

            return interaction.editReply({ content: replyMessage });
        }

        // --- /link status ---
        if (sub === "status") {
            const identifier = interaction.options.getString("identifier");
            await interaction.deferReply({ ephemeral: false });

            let userRecord = null;
            const discordIdMatch = identifier.match(/<@!?(\d+)>|^\d{17,19}$/);
            
            if (discordIdMatch) {
                const discordId = discordIdMatch[1] || identifier;
                userRecord = await findUserByDiscordId(discordId);
            } else {
                const robloxData = await getRobloxUser(identifier);
                if (robloxData) {
                    userRecord = await findUser(robloxData.id.toString());
                }
            }

            if (!userRecord || !userRecord.isVerified || !userRecord.discordId) {
                return interaction.editReply({ content: `ℹ️ No active verification link found for **${identifier}**.` });
            }

            const embed = new EmbedBuilder()
                .setTitle("🔗 Verification Status")
                .setColor(embedColor)
                .addFields(
                    { name: "Discord Account", value: `<@${userRecord.discordId}>`, inline: true },
                    { name: "Roblox Account", value: `[${userRecord.robloxUsername}](https://www.roblox.com/users/${userRecord.robloxId}/profile)`, inline: true },
                    { name: "Status", value: "✅ Linked", inline: true }
                )
                .setTimestamp();
            return interaction.editReply({ embeds: [embed] });
        }

        // --- /link remove ---
        if (sub === "remove") {
            const member = interaction.options.getMember("discord_member");
            await interaction.deferReply({ ephemeral: false });

            const user = await findUserByDiscordId(member.id);
            if (!user) {
                return interaction.editReply({ content: `⚠️ <@${member.id}> is not linked to any Roblox account.` });
            }
            
            try {
                // Panggil tanpa 'config'
                await removeVerification(member);
                
                // Hapus juga role rank mereka
                const rankMapping = config.rankToRoleMapping || {};
                const allRankRoleIds = Object.values(rankMapping);
                const rolesToRemove = member.roles.cache.filter(role => allRankRoleIds.includes(role.id));
                if (rolesToRemove.size > 0) {
                    await member.roles.remove(rolesToRemove);
                }
                
            } catch (error) {
                return interaction.editReply({ content: `❌ **Action Failed:** ${error.message}` });
            }

            const updatedUserData = { ...user, discordId: null, isVerified: false };
            await saveUser(updatedUserData);

            sendLog("🗑️ Unlink Log", "#FFA500", [
                { name: "Discord User", value: `<@${member.id}> (${member.user.tag})` },
                { name: "Roblox Account", value: `${user.robloxUsername} (${user.robloxId})` }
            ]);

            return interaction.editReply({ content: `✅ Successfully unlinked <@${member.id}> from **${user.robloxUsername}** and removed their rank roles.` });
        }

        // --- /link setup ---
        if (sub === "setup") {
            const targetChannel = interaction.options.getChannel("channel");
            if (!targetChannel || targetChannel.type !== ChannelType.GuildText) {
                 return interaction.reply({ content: `❌ Setup failed. Target channel must be a text channel.`, ephemeral: true });
            }
            const panel = generateVerificationPanel('setup');
            await targetChannel.send(panel);
            return interaction.reply({ content: `✅ Verification panel successfully posted in ${targetChannel}.`, ephemeral: true });
        }

        // --- /link initiate ---
        if (sub === "initiate") {
            const username = interaction.options.getString("roblox_username");
            await interaction.deferReply({ ephemeral: false });

            const robloxData = await getRobloxUser(username);
            if (!robloxData) return interaction.editReply({ content: "⚠️ Roblox user not found. Cannot initiate panel." });

            const robloxAvatar = await getRobloxAvatar(robloxData.id);
            const panelData = {
                username: robloxData.name,
                robloxId: robloxData.id,
                robloxAvatar: robloxAvatar,
                initiatorTag: interaction.user.tag,
                groupId: config.groupId
            };
            const panel = generateVerificationPanel('initiate', panelData);
            await interaction.channel.send(panel);
            return interaction.editReply({ content: `✅ Verification panel for **${robloxData.name}** successfully posted.` });
        }

    } catch (error) {
        logError(error, interaction, commandName);
        if (interaction.deferred || interaction.replied) {
            await interaction.editReply({ content: "❌ An unexpected error occurred." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred.", ephemeral: true });
        }
    }
}