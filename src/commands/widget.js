import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { findUserByDiscordId, saveUser, countUsersWhere, getAllUsers } from "../db/firestore.js";
import { getLevel, embedColor } from "../utils/helpers.js";
import { syncDiscordWidget } from "../utils/widgetSync.js";
import fetch from "node-fetch";

export const data = new SlashCommandBuilder()
    .setName("widget")
    .setDescription("Configure your Discord Profile Widget & Member Migration")
    .addSubcommand(sub =>
        sub.setName("link")
            .setDescription("Get the link to authorize the bot for your profile widget & member migration")
    )
    .addSubcommand(sub =>
        sub.setName("unlink")
            .setDescription("Disable automatic profile widget synchronization")
    )
    .addSubcommand(sub =>
        sub.setName("update")
            .setDescription("Manually trigger an update of your profile widget")
    )
    .addSubcommand(sub =>
        sub.setName("setup")
            .setDescription("Post the widget setup panel in a channel (Admin only)")
            .addChannelOption(opt =>
                opt.setName("channel")
                    .setDescription("The channel to post the panel in")
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName("migrate")
            .setDescription("Migrate authorized members to a new Discord server (Admin only)")
            .addStringOption(opt =>
                opt.setName("guild_id")
                    .setDescription("The target Discord server ID to migrate members to")
                    .setRequired(true)
            )
    );

export async function execute(interaction) {
    try {
        const subcommand = interaction.options.getSubcommand();
        const discordId = interaction.user.id;

        // Bypass verification requirement for setup and migrate commands (Admin only)
        if (subcommand !== "setup" && subcommand !== "migrate") {
            let user = await findUserByDiscordId(discordId);
            if (!user || !user.isVerified) {
                return interaction.reply({
                    content: "❌ **Error:** You must verify your Roblox account first using `/verify` before you can configure the profile widget.",
                    flags: 64
                });
            }
        }

        const clientId = process.env.CLIENT_ID || interaction.client.user.id;
        const clientSecret = process.env.CLIENT_SECRET;
        const port = process.env.PORT || 3000;

        let oauthLink;
        let redirectInstructions = "";

        // Check if clientSecret is configured and not the placeholder
        const isSecretConfigured = clientSecret &&
            clientSecret !== "paste_client_secret_anda_di_sini" &&
            clientSecret.trim() !== "";

        if (isSecretConfigured) {
            const redirectUri = `http://localhost:${port}/callback`;
            oauthLink = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid+sdk.social_layer+guilds.join`;
            redirectInstructions = `*(Please ensure you have registered \`http://localhost:${port}/callback\` in the Discord Developer Portal under OAuth2 > Redirects).*`;
        } else {
            const redirectUri = "https://discord.com/oauth2/authorized";
            oauthLink = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid+sdk.social_layer`;
            redirectInstructions = `*(Please ensure you have registered \`https://discord.com/oauth2/authorized\` in the Discord Developer Portal under OAuth2 > Redirects).*`;
        }

        if (subcommand === "link") {
            let user = await findUserByDiscordId(discordId);
            // Enable widget sync status in DB
            user.widgetEnabled = true;
            await saveUser(user);

            const embed = new EmbedBuilder()
                .setTitle("⚙️ Link Discord Profile Widget & Migration")
                .setDescription(
                    "To show your stats on your profile and authorize server migration, follow these steps:\n\n" +
                    `1. **Authorize the Bot**: [Click here to Authorize the Bot](${oauthLink})\n` +
                    `   *This grants the bot permission to update your widget and add you back in case of server migration.* ${redirectInstructions}\n\n` +
                    "2. **Verify App in Settings**: \n" +
                    "   - Open your Discord Client settings.\n" +
                    "   - Go to **Authorized Apps** and verify that this bot has the required permissions.\n\n" +
                    "3. **Add Widget to Profile**: \n" +
                    "   - Go to your Discord Profile.\n" +
                    "   - Click **Add Widget** (top right of your profile card) and select this bot.\n\n" +
                    "4. **Update/Test**: \n" +
                    "   - Run `/widget update` to push your current stats immediately."
                )
                .setColor(embedColor || "#1B1464")
                .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: 64 });
        }

        if (subcommand === "unlink") {
            let user = await findUserByDiscordId(discordId);
            user.widgetEnabled = false;
            await saveUser(user);

            return interaction.reply({
                content: "✅ Automatic widget updates have been **disabled** for your profile.",
                flags: 64
            });
        }

        if (subcommand === "update") {
            let user = await findUserByDiscordId(discordId);
            await interaction.deferReply({ flags: 64 });

            // Ensure widget is marked as enabled in DB
            if (!user.widgetEnabled) {
                user.widgetEnabled = true;
                await saveUser(user);
            }

            // Calculate global rank
            const rank = (await countUsersWhere("xp", ">", user.xp || 0)) + 1;
            const success = await syncDiscordWidget(discordId, user, rank);

            if (success) {
                const xp = user.xp || 0;
                const levelData = getLevel(xp);
                const expeditions = user.expeditions || 0;
                const achievementsCount = (user.achievements || []).length;
                const weeklyXp = user.weeklyXp || 0;

                const embed = new EmbedBuilder()
                    .setTitle("✅ Profile Widget Synchronized")
                    .setDescription("Successfully synchronized your latest stats to your Discord profile widget!")
                    .addFields(
                        { name: "Roblox User", value: user.robloxUsername || "Verified User", inline: true },
                        { name: "Rank Level", value: levelData.levelName, inline: true },
                        { name: "Leaderboard Rank", value: `#${rank}`, inline: true },
                        { name: "Lunar Points", value: `🌙 ${xp}`, inline: true },
                        { name: "Weekly XP", value: `📈 ${weeklyXp}`, inline: true },
                        { name: "Total Expeditions", value: `🧭 ${expeditions}`, inline: true },
                        { name: "Achievements", value: `🏅 ${achievementsCount}`, inline: true }
                    )
                    .setColor(embedColor || "#1B1464")
                    .setTimestamp();

                return interaction.editReply({ embeds: [embed] });
            } else {
                return interaction.editReply({
                    content: "❌ **Sync Failed:** Could not update your profile widget.\n\n" +
                        "**Possible Reasons:**\n" +
                        "1. You haven't authorized the widget scopes yet. Run `/widget link` and follow step 1.\n" +
                        "2. Discord API rate limit or transient network issues.\n\n" +
                        "Please verify your authorization status in **Discord Settings -> Authorized Apps** and try again."
                });
            }
        }

        if (subcommand === "setup") {
            // Check if user is administrator
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: "❌ **Error:** Only server administrators can use this command.",
                    flags: 64
                });
            }

            const channel = interaction.options.getChannel("channel");

            const embed1 = new EmbedBuilder()
                .setTitle("🌙 Mooncrest Profile Widget")
                .setDescription(
                    "Bring your game achievements directly to your Discord Profile! When linked, other players can view your real-time stats directly on your profile card.\n\n" +
                    "✨ **What will be displayed:**\n" +
                    "• **Rank Level** (e.g., Champions)\n" +
                    "• **Lunar Points**\n" +
                    "• **Total Expeditions**\n" +
                    "• **Achievements Count**\n" +
                    "• **Weekly LP**\n" +
                    "• **Global Leaderboard Rank**"
                )
                .setColor(embedColor || "#1B1464")
                .setImage("https://cdn.discordapp.com/attachments/1435964396408148088/1520835137741263079/image.png?ex=6a42a398&is=6a415218&hm=fe854b5338543e8ca390ba47186e378531d463ac4806cc66b3eeecfd897cd2f9");

            const embed2 = new EmbedBuilder()
                .setTitle("⚙️ Instructions to Setup Your Widget")
                .setDescription(
                    "Follow these simple steps to display the widget on your profile:\n\n" +
                    "1️⃣ **Authorize the Bot**:\n" +
                    "   - Click the **Link Profile Widget** button below.\n" +
                    "   - Click **Authorize** to link your widget and grant backup migration permission.\n\n" +
                    "2️⃣ **Enable Widget in Discord Settings**:\n" +
                    "   - Open your Discord settings, go to **Authorized Apps**.\n" +
                    "   - Ensure this bot has the required permissions (`sdk.social_layer`).\n\n" +
                    "3️⃣ **Add Widget to Profile**:\n" +
                    "   - Open your Discord Profile card.\n" +
                    "   - Click **Add Widget** (top right of your profile card) and select this bot.\n\n" +
                    "4️⃣ **Update / Force Sync**:\n" +
                    "   - Run `/widget update` to sync your stats immediately!"
                )
                .setColor(embedColor || "#1B1464")
                .setFooter({ text: "Please click the button below to link your profile widget." });

            const button = new ButtonBuilder()
                .setLabel("Link Profile Widget")
                .setStyle(ButtonStyle.Link)
                .setURL(oauthLink)
                .setEmoji("🔗");

            const row = new ActionRowBuilder().addComponents(button);

            await channel.send({ embeds: [embed1, embed2], components: [row] });
            return interaction.reply({ content: `✅ Widget setup panel successfully posted in ${channel}.`, flags: 64 });
        }

        if (subcommand === "migrate") {
            // Check if user is administrator
            if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({
                    content: "❌ **Error:** Only server administrators can trigger member migration.",
                    flags: 64
                });
            }

            const targetGuildId = interaction.options.getString("guild_id");
            await interaction.deferReply({ flags: 64 });

            try {
                const allUsers = await getAllUsers();
                const usersToMigrate = allUsers.filter(u => u.discordId && u.oauth && u.oauth.accessToken);

                if (usersToMigrate.length === 0) {
                    return interaction.editReply({
                        content: "⚠️ **No authorized users found.** Ask users to run `/widget link` to authorize first."
                    });
                }

                await interaction.editReply({
                    content: `🔄 **Starting migration of ${usersToMigrate.length} members to server \`${targetGuildId}\`...**`
                });

                let successCount = 0;
                let failCount = 0;

                for (const user of usersToMigrate) {
                    try {
                        const response = await fetch(`https://discord.com/api/v10/guilds/${targetGuildId}/members/${user.discordId}`, {
                            method: "PUT",
                            headers: {
                                Authorization: `Bot ${process.env.TOKEN}`,
                                "Content-Type": "application/json"
                            },
                            body: JSON.stringify({
                                access_token: user.oauth.accessToken
                            })
                        });

                        if (response.ok || response.status === 201 || response.status === 204) {
                            successCount++;
                        } else {
                            const errData = await response.json().catch(() => ({}));
                            console.error(`[Migration] Failed to add user ${user.discordId}:`, errData);
                            failCount++;
                        }
                    } catch (e) {
                        console.error(`[Migration] Network error for user ${user.discordId}:`, e);
                        failCount++;
                    }
                    // Wait 500ms between calls to avoid API rate limits
                    await new Promise(r => setTimeout(r, 500));
                }

                return interaction.editReply({
                    content: `✅ **Migration Complete!**\n\n🟢 Successfully added: **${successCount}**\n🔴 Failed/Already members: **${failCount}**`
                });
            } catch (e) {
                console.error("[Migration] Error during migration process:", e);
                return interaction.editReply({
                    content: `❌ **Error:** Migration failed: \`${e.message}\``
                });
            }
        }

    } catch (error) {
        console.error("[WidgetCommand] Error in widget command:", error);
        if (interaction.deferred) {
            await interaction.editReply({ content: "❌ An unexpected error occurred while executing this command." });
        } else {
            await interaction.reply({ content: "❌ An unexpected error occurred while executing this command.", flags: 64 });
        }
    }
}

// --- BUTTON INTERACTION HANDLER FOR WIDGET LINK ---
export async function handleWidgetButton(interaction) {
    const customId = interaction.customId;
    try {
        if (customId === "widget_link_initiate") {
            const discordId = interaction.user.id;
            let user = await findUserByDiscordId(discordId);

            if (!user || !user.isVerified) {
                return interaction.reply({
                    content: "❌ **Error:** You must verify your Roblox account first using `/verify` before you can configure the profile widget.",
                    flags: 64
                });
            }

            const clientId = process.env.CLIENT_ID || interaction.client.user.id;
            const clientSecret = process.env.CLIENT_SECRET;
            const port = process.env.PORT || 3000;

            let oauthLink;
            let redirectInstructions = "";

            // Check if clientSecret is configured and not the placeholder
            const isSecretConfigured = clientSecret &&
                clientSecret !== "paste_client_secret_anda_di_sini" &&
                clientSecret.trim() !== "";

            if (isSecretConfigured) {
                const redirectUri = `http://localhost:${port}/callback`;
                oauthLink = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid+sdk.social_layer+guilds.join`;
                redirectInstructions = `*(Please ensure you have registered \`http://localhost:${port}/callback\` in the Discord Developer Portal under OAuth2 > Redirects).*`;
            } else {
                const redirectUri = "https://discord.com/oauth2/authorized";
                oauthLink = `https://discord.com/oauth2/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid+sdk.social_layer`;
                redirectInstructions = `*(Please ensure you have registered \`https://discord.com/oauth2/authorized\` in the Discord Developer Portal under OAuth2 > Redirects).*`;
            }

            // Enable widget sync status in DB
            user.widgetEnabled = true;
            await saveUser(user);

            const embed = new EmbedBuilder()
                .setTitle("⚙️ Link Discord Profile Widget & Migration")
                .setDescription(
                    "To show your stats on your profile and authorize server migration, follow these steps:\n\n" +
                    `1. **Authorize the Bot**: [Click here to Authorize the Bot](${oauthLink})\n` +
                    `   *This grants the bot permission to update your widget and add you back in case of server migration.* ${redirectInstructions}\n\n` +
                    "2. **Verify App in Settings**: \n" +
                    "   - Open your Discord Client settings.\n" +
                    "   - Go to **Authorized Apps** and verify that this bot has the required permissions.\n\n" +
                    "3. **Add Widget to Profile**: \n" +
                    "   - Go to your Discord Profile.\n" +
                    "   - Click **Add Widget** (top right of your profile card) and select this bot.\n\n" +
                    "4. **Update/Test**: \n" +
                    "   - Run `/widget update` to push your current stats immediately."
                )
                .setColor(embedColor || "#1B1464")
                .setTimestamp();

            return interaction.reply({ embeds: [embed], flags: 64 });
        }
    } catch (e) {
        console.error("[WidgetButton] Error handling button interaction:", e);
        return interaction.reply({ content: "❌ An error occurred while processing this button.", flags: 64 });
    }
}
