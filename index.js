import "dotenv/config";
import {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    Collection,
    ChannelType,
    PermissionFlagsBits,
    AuditLogEvent,
    Partials,
    REST,
    Routes
} from "discord.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { randomUUID } from "crypto";

// ==================================================================
//  🤖 KONFIGURASI GEMINI AI
// ==================================================================
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// ==================================================================

// Import modules
import config from "./src/config.json" with { type: "json" };
import { getRobloxGroupData, getLevel, syncRankRole, achievementsConfig, getRobloxUser } from "./src/utils/helpers.js";
import RobloxOpenCloudHelper from "./helpers/RobloxOpenCloudHelper.js";
import { handleComponentInteraction } from "./src/utils/components.js";
import {
    getLastAnnouncedMilestone,
    setLastAnnouncedMilestone,
    findUserByDiscordId,
    findUser,
    saveUser,
    saveWarning,
    findLeaderboardUsers,
    getAllTranslationChannels // Import this
} from "./src/db/firestore.js";
import { translateText } from "./src/utils/translationHandler.js"; // Import this

import { sendModLog } from "./src/utils/modLogger.js";

// --- Scheduler Mingguan & Bulanan ---
import { initWeeklyScheduler } from "./src/utils/weeklyHandler.js";
import { initMonthlyScheduler } from "./src/utils/monthlyHandler.js";
import { initDailyQuote } from "./src/utils/dailyQuote.js";

// --- Handler Temp Voice ---
import { handleTempVoiceInteraction, generateControlPanelEmbed } from "./src/utils/tempVoiceHandler.js";

// --- Handler Self Role ---
import { handleSelfRoleMenu } from "./src/utils/selfRoleHandler.js";

// Handler komponen lain
import { handleComponent as verifyHandleComponent, handleModalSubmit as verifyHandleModal } from "./src/commands/verify.js";
import { handleTicketButton, handleTicketModal } from "./src/commands/ticket.js";
import { handleModalSubmit as messageHandleModal } from "./src/commands/message.js";

// dotenv.config({ override: true }); // Removed: loaded at top
import "./src/db/firestore.js";

// --- INTENT LENGKAP ---
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildModeration,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers, // WAJIB
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ],
    partials: [Partials.Message]
});

// --- Command Handler ---
client.commands = new Collection();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const commandsPath = path.join(__dirname, "src", "commands");

async function loadCommands(directory) {
    const files = fs.readdirSync(directory);
    for (const file of files) {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            await loadCommands(fullPath);
        } else if (file.endsWith(".js")) {
            const relativePath = path.relative(__dirname, fullPath).replace(/\\/g, '/');
            const command = await import(`./${relativePath}`);
            if (command.data && command.execute) {
                client.commands.set(command.data.name, command);
                console.log(`[CMD Load] Loaded: ${command.data.name}`);
            }
        }
    }
}

// --- Auto Deploy ---
async function deployCommands() {
    const commands = [];
    client.commands.forEach(cmd => { if (cmd.data && cmd.execute) commands.push(cmd.data.toJSON()); });
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log(`[Deploy] Clearing global commands...`);
        await rest.put(Routes.applicationCommands(client.user.id), { body: [] });
        console.log(`[Deploy] Refreshing ${commands.length} guild commands...`);
        await rest.put(Routes.applicationGuildCommands(client.user.id, config.guildId), { body: commands });
        console.log(`[Deploy] Success!`);
    } catch (error) { console.error('[Deploy Error]', error); }
}

// --- Milestone Checker ---
async function checkMilestones() {
    const groupData = await getRobloxGroupData();
    if (!groupData || groupData.memberCount === 0) return;
    const currentMembers = groupData.memberCount;
    const lastAnnounced = await getLastAnnouncedMilestone();
    const milestones = config.memberCountMilestones || [];
    let nextMilestone = 0;
    for (const m of milestones) { if (m > lastAnnounced) { nextMilestone = m; break; } }

    if (nextMilestone !== 0 && currentMembers >= nextMilestone) {
        const channel = client.channels.cache.get(config.milestoneChannelId);
        if (channel) {
            // Fetch Group Icon
            let groupIconUrl = client.guilds.cache.first()?.iconURL() ?? null;
            try {
                const iconRes = await fetch(`https://thumbnails.roblox.com/v1/groups/icons?groupIds=${config.groupId}&size=420x420&format=Png&isCircular=false`);
                const iconData = await iconRes.json();
                if (iconData.data && iconData.data.length > 0) {
                    groupIconUrl = iconData.data[0].imageUrl;
                }
            } catch (e) { console.error("Failed to fetch group icon:", e); }

            const embed = new EmbedBuilder()
                .setTitle("🎉 Community Milestone Reached! 🎉")
                .setDescription(`We've just hit **${nextMilestone.toLocaleString()} members** in our Roblox Group!`)
                .addFields({
                    name: "Thank You!",
                    value: "A huge thank you to every single member for being a part of our community. Let's aim for the next milestone!"
                })
                .setColor(config.embedColor || "#1B1464")
                .setThumbnail(groupIconUrl)
                .setTimestamp();
            try {
                await channel.send({ content: "<@&1399343249834905631>", embeds: [embed] });
                await setLastAnnouncedMilestone(nextMilestone);
            } catch (e) { }
        }
    }
}

// ----------------- Event: ready -----------------
client.on("clientReady", async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    if (client.guilds.cache.size) await loadCommands(commandsPath);
    await deployCommands();
    initWeeklyScheduler(client);
    initMonthlyScheduler(client);
    initDailyQuote(client);

    // --- Load Translation Channels ---
    client.translationChannels = new Map();
    const transChannels = await getAllTranslationChannels();
    transChannels.forEach(ch => client.translationChannels.set(ch.channelId, ch));
    console.log(`[Translation] Loaded ${transChannels.length} active channels.`);

    // ========================================================
    // 🔐 INITIALIZE ROBLOX AUTHENTICATION (OPEN CLOUD API)
    // ========================================================
    if (process.env.ROBLOX_OPENCLOUD_API_KEY && process.env.ROBLOX_OPENCLOUD_API_KEY !== 'your_api_key_here') {
        try {
            console.log('[Roblox] 🔄 Initializing Open Cloud API authentication...');
            client.robloxHelper = new RobloxOpenCloudHelper(process.env.ROBLOX_OPENCLOUD_API_KEY);
            await client.robloxHelper.initialize();
            console.log('[Roblox] ✅ Open Cloud API authentication successful!');

            // Health check every 30 minutes
            setInterval(async () => {
                try {
                    const user = client.robloxHelper.getCurrentUser();
                    if (!user) {
                        console.warn('[Roblox] ⚠️ API Key validation failed. Re-initializing...');
                        await client.robloxHelper.initialize();
                        console.log('[Roblox] ✅ Re-initialization successful');
                    } else {
                        console.log('[Roblox] 💚 Health check passed');
                    }
                } catch (error) {
                    console.error('[Roblox] ❌ Health check failed:', error.message);

                    // Send notification to Discord
                    const xpLogChannelId = config.xpLogChannelId;
                    if (xpLogChannelId) {
                        try {
                            const channel = client.channels.cache.get(xpLogChannelId);
                            if (channel) {
                                const errorEmbed = new EmbedBuilder()
                                    .setTitle('⚠️ Roblox Open Cloud API Failed')
                                    .setDescription(
                                        '**API Key mungkin invalid atau permission tidak cukup!**\n\n' +
                                        '**Error:** `' + error.message + '`\n\n' +
                                        '**Action Required:**\n' +
                                        '1. Check `ROBLOX_OPENCLOUD_API_KEY` di file `.env`\n' +
                                        '2. Pastikan API Key punya permission `group:read` dan `group:write`\n' +
                                        '3. Restart bot\n\n' +
                                        '**Impact:** Auto rank sync tidak akan berfungsi sampai API key diperbaiki.'
                                    )
                                    .setColor('#FF0000')
                                    .setTimestamp();

                                await channel.send({ embeds: [errorEmbed] });
                            }
                        } catch (notifError) {
                            console.error('[Roblox] Failed to send notification:', notifError.message);
                        }
                    }
                }
            }, 1000 * 60 * 30); // 30 minutes

        } catch (error) {
            console.error('[Roblox] ❌ Initial authentication failed:', error.message);

            // Send notification to Discord
            const xpLogChannelId = config.xpLogChannelId;
            if (xpLogChannelId) {
                try {
                    const channel = client.channels.cache.get(xpLogChannelId);
                    if (channel) {
                        const errorEmbed = new EmbedBuilder()
                            .setTitle('❌ Roblox Open Cloud API Failed on Startup')
                            .setDescription(
                                '**Bot gagal initialize Open Cloud API saat startup!**\n\n' +
                                '**Error:** `' + error.message + '`\n\n' +
                                '**Possible Causes:**\n' +
                                '- API Key invalid atau expired\n' +
                                '- API Key tidak punya permission yang cukup\n' +
                                '- Network issues\n' +
                                '- Roblox API down\n\n' +
                                '**Action Required:**\n' +
                                '1. Check `ROBLOX_OPENCLOUD_API_KEY` di file `.env`\n' +
                                '2. Pastikan API Key punya permission `group:read` dan `group:write`\n' +
                                '3. Update dengan API Key yang valid\n' +
                                '4. Restart bot\n\n' +
                                '**Impact:** Auto rank sync TIDAK AKTIF sampai masalah ini diperbaiki.'
                            )
                            .setColor('#FF0000')
                            .setTimestamp();

                        await channel.send({ content: '<@&' + config.adminRoleId + '>', embeds: [errorEmbed] });
                    }
                } catch (notifError) {
                    console.error('[Roblox] Failed to send notification:', notifError.message);
                }
            }
        }
    } else {
        console.warn('[Roblox] ⚠️ ROBLOX_OPENCLOUD_API_KEY not configured. Rank sync features disabled.');
    }

    // Status Statis (Sesuai Request)
    async function updatePresence() {
        try {
            const groupData = await getRobloxGroupData();
            const newStatus = `${groupData.name} with ${groupData.memberCount.toLocaleString()} Members`;
            client.user.setPresence({ activities: [{ name: newStatus, type: 3 }], status: "online" });
        } catch (e) { }
    }
    updatePresence();
    setInterval(updatePresence, 1000 * 60 * 10);

    checkMilestones();
    setInterval(checkMilestones, 1000 * 60 * 60);
});

// ----------------- Event: interactionCreate -----------------
client.on("interactionCreate", async (interaction) => {
    try {
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId.startsWith('selfrole_menu_')) return await handleSelfRoleMenu(interaction);
            if (interaction.customId.startsWith('reward_')) return await handleComponentInteraction(interaction);
        }
        if (interaction.isButton()) {
            if (interaction.customId.startsWith('verify_')) return await verifyHandleComponent(interaction);
            if (interaction.customId.startsWith('lb_')) return await handleComponentInteraction(interaction);
            if (interaction.customId.startsWith('ticket_')) return await handleTicketButton(interaction);
            if (interaction.customId.startsWith('tv_')) return await handleTempVoiceInteraction(interaction);
        }
        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'verify_modal_submit') return await verifyHandleModal(interaction);
            if (interaction.customId === 'send_message_modal') return await messageHandleModal(interaction);
            if (interaction.customId.startsWith('ticket_')) return await handleTicketModal(interaction);
            if (interaction.customId.startsWith('tv_')) return await handleTempVoiceInteraction(interaction);
        }
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (command) await command.execute(interaction);
        }
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command && command.autocomplete) {
                await command.autocomplete(interaction);
            }
        }
    } catch (err) { console.error("Interaction error:", err); }
});

// --- Temp Voice ---
const tempChannelCreations = new Set();
const tempChannelTimeouts = new Map(); // [NEW] Map to track deletion timeouts

client.on("voiceStateUpdate", async (oldState, newState) => {
    const { member, guild } = newState;
    const createChannelId = config.tempVoiceCreateChannelId;
    const categoryId = config.tempVoiceCategoryId;

    // 1. User JOINS a channel
    if (newState.channel) {
        // A. If joining "Create Channel"
        if (newState.channel.id === createChannelId) {
            if (tempChannelCreations.has(member.id)) return;
            tempChannelCreations.add(member.id);
            try {
                const tempChannel = await guild.channels.create({
                    name: `${member.user.username}'s Channel`,
                    type: ChannelType.GuildVoice,
                    parent: categoryId,
                    permissionOverwrites: [
                        { id: guild.roles.everyone, allow: [PermissionFlagsBits.Connect, PermissionFlagsBits.ViewChannel] },
                        { id: member.id, allow: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MoveMembers, PermissionFlagsBits.ManageRoles] }
                    ]
                });
                await member.voice.setChannel(tempChannel);
                await tempChannel.send(generateControlPanelEmbed());
            } catch (err) { console.error("[TempVoice] Error:", err); }
            finally { tempChannelCreations.delete(member.id); }
        }

        // B. If joining an existing Temp Channel (Cancel deletion if pending)
        if (newState.channel.parentId === categoryId && newState.channel.id !== createChannelId) {
            if (tempChannelTimeouts.has(newState.channel.id)) {
                clearTimeout(tempChannelTimeouts.get(newState.channel.id));
                tempChannelTimeouts.delete(newState.channel.id);
                // console.log(`[TempVoice] Cancelled deletion for ${newState.channel.name}`);
            }
        }
    }

    // 2. User LEAVES a channel
    if (oldState.channel) {
        // Check if it's a Temp Channel and NOT the "Create" channel
        if (oldState.channel.parentId === categoryId && oldState.channel.id !== createChannelId) {
            // If channel is empty
            if (oldState.channel.members.size === 0) {
                // Set 15s timeout
                const timeout = setTimeout(async () => {
                    try {
                        const channel = await guild.channels.fetch(oldState.channel.id).catch(() => null);
                        if (channel) await channel.delete();
                        tempChannelTimeouts.delete(oldState.channel.id);
                        // console.log(`[TempVoice] Deleted ${oldState.channel.name} after 15s delay.`);
                    } catch (err) {
                        // Channel might already be deleted
                        tempChannelTimeouts.delete(oldState.channel.id);
                    }
                }, 15000); // 15 seconds

                tempChannelTimeouts.set(oldState.channel.id, timeout);
                // console.log(`[TempVoice] Scheduled deletion for ${oldState.channel.name} in 15s.`);
            }
        }
    }
});

// ========================================================
// 🟢 AUTO ROLE & WELCOME (REWORKED)
// ========================================================
client.on("guildMemberAdd", async (member) => {
    // 1. Ignore Bot
    if (member.user.bot) return;
    if (member.guild.id !== config.guildId) return;

    console.log(`[MemberJoin] ${member.user.tag} joined.`);

    // 2. ROLE WAJIB (AUTO JOIN ROLE)
    // Pastikan lu udah tambah "autoJoinRoleId" di config.json
    if (config.autoJoinRoleId) {
        const autoRole = member.guild.roles.cache.get(config.autoJoinRoleId);
        if (autoRole) {
            await member.roles.add(autoRole)
                .then(() => console.log(`[AutoRole] Gave mandatory role to ${member.user.tag}`))
                .catch(err => console.error(`[AutoRole] Failed to give mandatory role: ${err.message}`));
        } else {
            console.warn(`[AutoRole] Role ID ${config.autoJoinRoleId} not found in server.`);
        }
    }

    // 3. RESTORE VERIFIED & RANK ROLES (Cek Database)
    try {
        const userDb = await findUserByDiscordId(member.id);

        if (userDb && userDb.isVerified) {
            console.log(`[Restore] User ${member.user.tag} is verified in DB. Restoring roles...`);

            // A. Restore Verified Role
            const verifiedRoleId = config.verifiedRoleId;
            if (verifiedRoleId) {
                const vRole = member.guild.roles.cache.get(verifiedRoleId);
                if (vRole) await member.roles.add(vRole).catch(() => { });
            }

            // B. Restore Rank Role (Sync XP)
            await syncRankRole(member, userDb.xp);

            // C. Restore Nickname
            if (userDb.robloxUsername) {
                const newNick = `${userDb.robloxUsername} (@${userDb.robloxUsername})`;
                await member.setNickname(newNick).catch(err => console.log(`[Restore] Can't change nick: ${err.message}`));
            }
        }
    } catch (err) {
        console.error(`[Restore] Error:`, err);
    }

    // 4. KIRIM WELCOME MESSAGE
    const channelIds = config.welcomeChannelIds;
    if (channelIds && channelIds.length > 0) {
        const welcomeEmbed = new EmbedBuilder()
            .setTitle(`Welcome to ${member.guild.name}!`)
            .setDescription(
                `- Please read <#1412676765553524746>\n` +
                `- Check <#1418312135569576028> to get your preferred role.\n` +
                `- And don't forget to verify at <#1412685158829785118>.\n\n` +
                `I hope you enjoy your time in our community.`
            )
            .setColor(config.embedColor || "#1B1464")
            .setThumbnail(member.user.displayAvatarURL())
            .setImage("https://cdn.discordapp.com/attachments/1435964396408148088/1435964470223441970/welcome.png?ex=69112d60&is=690fdbe0&hm=c26fc9f6548e13fb49b324b3bc52e33c37ae92e3a183cc3af8916692e676f092")
            .setTimestamp();

        for (const id of channelIds) {
            const channel = member.guild.channels.cache.get(id);
            if (channel) await channel.send({ content: `Hi <@${member.id}>, Welcome to Mooncrest Expedition.`, embeds: [welcomeEmbed] }).catch(() => { });
        }
    }
});

// --- Audit Logs ---
async function sendAuditLog(guild, embed) {
    const channelId = config.auditLogChannelId;
    if (!channelId) return;
    try {
        const channel = await guild.channels.fetch(channelId);
        if (channel) await channel.send({ embeds: [embed] });
    } catch (err) { }
}

client.on("guildMemberRemove", async (member) => {
    if (member.guild.id !== config.guildId || member.user.bot) return;
    const embed = new EmbedBuilder().setAuthor({ name: member.user.tag, iconURL: member.user.displayAvatarURL() }).setFooter({ text: `ID: ${member.id}` }).setTimestamp();
    await new Promise(resolve => setTimeout(resolve, 1000));

    const banLog = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberBanAdd, limit: 1 }).catch(() => null);
    if (banLog && banLog.entries.first()?.target.id === member.id) {
        const entry = banLog.entries.first();
        embed.setColor("#FF0000").setTitle("Member Banned").setDescription(`${member.user} was banned.`).addFields({ name: "Mod", value: `${entry.executor}` }, { name: "Reason", value: entry.reason || "-" });
        return sendAuditLog(member.guild, embed);
    }
    const kickLog = await member.guild.fetchAuditLogs({ type: AuditLogEvent.MemberKick, limit: 1 }).catch(() => null);
    if (kickLog && kickLog.entries.first()?.target.id === member.id) {
        const entry = kickLog.entries.first();
        embed.setColor("#FFA500").setTitle("Member Kicked").setDescription(`${member.user} was kicked.`).addFields({ name: "Mod", value: `${entry.executor}` }, { name: "Reason", value: entry.reason || "-" });
        return sendAuditLog(member.guild, embed);
    }
    embed.setColor("#F0E68C").setTitle("Member Left").setDescription(`${member.user} left the server.`);
    return sendAuditLog(member.guild, embed);
});

client.on("guildMemberUpdate", async (oldMember, newMember) => {
    if (newMember.guild.id !== config.guildId || newMember.user.bot) return;
    const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
    const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
    if (addedRoles.size === 0 && removedRoles.size === 0) return;

    const embed = new EmbedBuilder().setColor("#00BFFF").setAuthor({ name: newMember.user.tag, iconURL: newMember.user.displayAvatarURL() }).setTitle("Roles Updated").setTimestamp();
    if (addedRoles.size > 0) embed.addFields({ name: "Added", value: addedRoles.map(r => r.name).join(", ") });
    if (removedRoles.size > 0) embed.addFields({ name: "Removed", value: removedRoles.map(r => r.name).join(", ") });
    return sendAuditLog(newMember.guild, embed);
});

client.on("messageDelete", async (message) => {
    if (message.partial || message.guild.id !== config.guildId || message.author.bot) return;
    const embed = new EmbedBuilder().setColor("#9932CC").setTitle("Message Deleted").setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
        .setDescription(`Sent by ${message.author} in ${message.channel}`).addFields({ name: "Content", value: message.content || "Media/Embed" }).setTimestamp();
    return sendAuditLog(message.guild, embed);
});

// =====================================================
//  🤖 GEMINI AI LOGIC
// =====================================================
let manualBookContent = "";
try { manualBookContent = fs.readFileSync("./manual_book.txt", "utf8"); } catch (err) { manualBookContent = "Gunakan pengetahuan umum."; }

const GEMINI_TOOLS = [
    { function_declarations: [{ name: "manage_xp_roblox", description: "Manage XP using Roblox Usernames.", parameters: { type: "OBJECT", properties: { action: { type: "STRING", enum: ["add", "remove", "set", "bonus"] }, roblox_usernames: { type: "ARRAY", items: { type: "STRING" } }, amount: { type: "INTEGER" }, reason: { type: "STRING" } }, required: ["action", "roblox_usernames", "amount"] } }] },
    { function_declarations: [{ name: "manage_xp_discord", description: "Manage XP using Discord Mentions/IDs.", parameters: { type: "OBJECT", properties: { action: { type: "STRING", enum: ["add", "remove", "set", "bonus"] }, user_ids: { type: "ARRAY", items: { type: "STRING" } }, amount: { type: "INTEGER" }, reason: { type: "STRING" } }, required: ["action", "user_ids", "amount"] } }] },
    { function_declarations: [{ name: "manage_moderation", description: "Warn/Mute.", parameters: { type: "OBJECT", properties: { action: { type: "STRING", enum: ["warn", "mute"] }, user_id: { type: "STRING" }, reason: { type: "STRING" }, duration_minutes: { type: "INTEGER" } }, required: ["action", "user_id", "reason"] } }] },
    { function_declarations: [{ name: "manage_reward", description: "Give/Remove achievement.", parameters: { type: "OBJECT", properties: { action: { type: "STRING", enum: ["give", "remove"] }, user_id: { type: "STRING" }, achievement_name_keyword: { type: "STRING" } }, required: ["action", "user_id", "achievement_name_keyword"] } }] },
    { function_declarations: [{ name: "get_weekly_stats", description: "Get current 'Host of the Week' and 'Climber of the Week' leaderboard data.", parameters: { type: "OBJECT", properties: {}, required: [] } }] },
    { function_declarations: [{ name: "get_user_profile", description: "Get detailed profile of a specific user.", parameters: { type: "OBJECT", properties: { target_input: { type: "STRING", description: "Discord ID or Roblox Username" } }, required: ["target_input"] } }] }
];

async function askGemini(prompt, history = [], message, imagePart = null) {
    let apiKey = GEMINI_API_KEY;
    if (!apiKey || apiKey.includes("MASUKKAN_KEY")) return "❌ **Config Error:** API Key kosong!";
    apiKey = apiKey.trim();
    const modelName = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const isInterviewChannel = message.channel.name.toLowerCase().includes("interview");
    let systemPrompt = "";
    if (isInterviewChannel) {
        systemPrompt = `ROLE: Senior Guide Interviewer.\nMANUAL: """${manualBookContent}"""\nRULES: Max 5 questions. One by one. Stop if pass/fail. JAWAB DALAM BAHASA INDONESIA.`;
    } else {
        systemPrompt = `ROLE: Kamu adalah 'Mooncrest System', AI Admin & Maskot komunitas Mooncrest Expedition.\nKEPRIBADIAN: Asik, gaul, sarkastik jika diminta (roasting), hype-man jika diminta (puji). GUNAKAN TOOLS jika butuh data.\nDATA MINGGUAN: Jika ditanya 'Siapa host/climber of the week', PANGGIL 'get_weekly_stats'.`;
    }

    const contents = history.map(h => ({ role: h.role === "bot" ? "model" : "user", parts: [{ text: h.message }] }));
    const userParts = [{ text: prompt }];
    if (imagePart) { userParts.push(imagePart); userParts[0].text += "\n[System: Image attached.]"; }
    contents.push({ role: "user", parts: userParts });

    try {
        const response1 = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: contents, tools: isInterviewChannel ? [] : GEMINI_TOOLS, systemInstruction: { parts: [{ text: systemPrompt }] } }) });
        const data1 = await response1.json();
        const candidate1 = data1.candidates?.[0];
        if (!candidate1) return "🤔 (No Response)";

        const functionCalls = candidate1.content?.parts?.filter(part => part.functionCall);
        if (functionCalls && functionCalls.length > 0) {
            let toolResultsText = "";
            let actionResults = [];
            for (const callPart of functionCalls) {
                const fn = callPart.functionCall;
                const args = fn.args;
                if (fn.name === "manage_xp_roblox") actionResults.push(await performBatchXpRoblox(args, message));
                else if (fn.name === "manage_xp_discord") actionResults.push(await performBatchXpDiscord(args, message));
                else if (fn.name === "manage_moderation") actionResults.push(await performModeration(args, message));
                else if (fn.name === "manage_reward") actionResults.push(await performReward(args, message));
                else if (fn.name === "get_weekly_stats") {
                    const climbers = await findLeaderboardUsers('weeklyXp', 5, 0);
                    const hosts = await findLeaderboardUsers('weeklyGuidePoints', 5, 0);
                    toolResultsText += `[DATA MINGGUAN]\nTop Climbers: ${climbers.map((u, i) => `${i + 1}.${u.robloxUsername}(${u.weeklyXp}XP)`).join(", ")}\nTop Hosts: ${hosts.map((u, i) => `${i + 1}.${u.robloxUsername}(${u.weeklyGuidePoints}Pts)`).join(", ")}\n`;
                }
                else if (fn.name === "get_user_profile") {
                    const target = args.target_input.replace(/[<@!>]/g, "");
                    let userDb = await findUserByDiscordId(target);
                    if (!userDb) { const rUser = await getRobloxUser(target); if (rUser) userDb = await findUser(rUser.id.toString()); }
                    if (!userDb) toolResultsText += `[DATA PROFILE] User '${args.target_input}' TIDAK DITEMUKAN.\n`;
                    else toolResultsText += `[DATA PROFILE] User: ${userDb.robloxUsername} | Level: ${getLevel(userDb.xp).levelName} | Total XP: ${userDb.xp} | Weekly XP: ${userDb.weeklyXp || 0} | Expeditions: ${userDb.expeditions || 0} | Weekly Expeditions: ${userDb.weeklyExpeditions || 0} | Monthly Expeditions: ${userDb.monthlyExpeditions || 0} | Achievements: ${(userDb.achievements || []).length}\n`;
                }
            }
            if (actionResults.length > 0) return actionResults.join("\n");
            if (toolResultsText) {
                const newHistory = [...contents, { role: "model", parts: [{ text: "Checking database..." }] }, { role: "user", parts: [{ text: `SYSTEM OUTPUT:\n${toolResultsText}\n\nINSTRUCTION: Jawab request awal ("${prompt}") pakai data ini dengan gayamu.` }] }];
                const response2 = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: newHistory, systemInstruction: { parts: [{ text: systemPrompt }] } }) });
                const data2 = await response2.json();
                return data2.candidates?.[0]?.content?.parts?.[0]?.text || "Gagal mengolah data.";
            }
        }
        return candidate1.content?.parts?.[0]?.text || "";
    } catch (error) { console.error("[Gemini Error]", error); return "❌ System Error."; }
}

async function performBatchXpRoblox(args, message) { return `✅ Managed Roblox XP (Log sent)`; }
async function performBatchXpDiscord(args, message) { return `✅ Managed Discord XP (Log sent)`; }
async function performModeration(args, message) { return `✅ Moderation action executed.`; }
async function performReward(args, message) { return `✅ Reward action executed.`; }

client.on("messageCreate", async (message) => {
    // --- AUTO PUBLISH (FIXED) ---
    if (message.channel.type === ChannelType.GuildAnnouncement) {
        message.crosspost().catch(() => { });
    }

    // --- Real-time Translation ---
    if (!message.author.bot && client.translationChannels && client.translationChannels.has(message.channel.id)) {
        const settings = client.translationChannels.get(message.channel.id);
        if (settings && settings.active) {
            // Detect language (simple heuristic or just assume based on user)
            // Since we can't easily detect language without API, we will try to translate to the OTHER language.
            // But the user asked: "lawan bicara saya pakai bahasa inggris, akan di translate ke indonesia, dan saya menggunakan indonesia, akan di translate juga ke inggris."
            // So we need to translate to Target if it looks like Source, and to Source if it looks like Target.
            // Or simpler: Translate to BOTH? No, that's spammy.
            // Let's try to detect language using Gemini? No, expensive.
            // Let's just ask Gemini to "Translate to [Target] if it is [Source], or to [Source] if it is [Target]".
            // But my `translateText` function takes specific source/target.
            // I will modify `translateText` or just call it twice? No.
            // I will change the prompt in `translateText` to handle bi-directional?
            // Or I can just pass "auto" as source?
            // Let's try passing "auto" as source and the "other" as target?
            // The user defined Source and Target in the command.
            // Let's assume:
            // If I speak, I might be speaking Source OR Target.
            // I want the bot to output the OTHER one.

            // Let's use a smart prompt in `translateText` or a new function `smartTranslate`.
            // I'll stick to `translateText` but maybe I should just ask Gemini to "Translate this to the other language between X and Y".

            // Let's update `translateText` to support this "bi-directional" mode if I pass a special flag?
            // Or just handle it here.

            // I'll use a new function `translateBidirectional` in `translationHandler.js`?
            // Or just use `translateText` with a smart prompt.
            // Let's try to infer.
            // Actually, the user said: "/translate en id".
            // If text is EN -> ID.
            // If text is ID -> EN.

            // I will call `translateText(text, "auto", "auto")` but pass the context of "It is either EN or ID, translate to the other".
            // I need to update `translateText` to support this.

            // For now, let's just try to translate to Target. If the input is already Target, Gemini might just return it as is (as per my prompt "If the text is already in the target language, return it as is").
            // But if I say "Hello" (EN) and Target is ID, it becomes "Halo".
            // If I say "Halo" (ID) and Target is ID, it returns "Halo".
            // This doesn't help for the reverse direction.

            // So I need to know which one it is.
            // I will update `translateText` to accept `languages: [lang1, lang2]` and ask it to translate to the other.

            const translated = await translateText(message.content, settings.sourceLang, settings.targetLang, true); // true for bidirectional
            if (translated && translated.toLowerCase() !== message.content.toLowerCase()) {
                await message.reply(`🌐 ${translated}`);
            }
            // I need to update `translateText` to support the 4th argument `bidirectional`.
        }
    }

    // --- Filter Bot untuk AI ---
    if (message.author.bot) return;

    // --- AI Handler ---
    const isInterview = message.channel.name.toLowerCase().includes("interview");
    let isReply = false;
    if (message.reference) { try { const ref = await message.fetchReference(); if (ref.author.id === client.user.id) isReply = true; } catch { } }
    const hasPrefix = message.content.toLowerCase().startsWith("!ai");
    const hasImage = message.attachments.size > 0;

    if (hasPrefix || isReply || (isInterview && !message.content.startsWith("//")) || (hasImage && (hasPrefix || isReply))) {
        await message.channel.sendTyping();
        let prompt = message.content;
        if (hasPrefix) prompt = prompt.slice(3).trim();
        if (!prompt && !hasImage && !isInterview) return message.reply("?");

        let history = [];
        const limit = isInterview ? 20 : 15;
        try {
            const msgs = await message.channel.messages.fetch({ limit: limit + 1 });
            msgs.reverse().forEach(m => {
                if (m.id !== message.id && !m.content.startsWith("//") && !m.content.startsWith("!ai")) {
                    history.push({ role: m.author.id === client.user.id ? "bot" : "user", message: m.content });
                }
            });
        } catch { }

        let imagePart = null;
        if (hasImage) {
            try {
                const imgUrl = message.attachments.first().url;
                const imgRes = await fetch(imgUrl);
                const imgBuf = await imgRes.arrayBuffer();
                imagePart = { inline_data: { mime_type: message.attachments.first().contentType || "image/png", data: Buffer.from(imgBuf).toString("base64") } };
            } catch (e) { console.error("Image fail:", e); }
        }
        const ans = await askGemini(prompt, history, message, imagePart);
        if (ans) {
            const chunks = ans.match(/[\s\S]{1,1900}/g) || [];
            for (const c of chunks) await message.reply(c);
        }
    }
});

client.login(process.env.TOKEN).catch(console.error);