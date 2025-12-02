import cron from "node-cron";
import { EmbedBuilder } from "discord.js";
import admin from "firebase-admin";
import config from "../config.json" with { type: "json" };

// --- KONFIGURASI ---
// Ganti channel ID ini kalau mau khusus, atau biarkan pakai log channel
const ANNOUNCE_CHANNEL_ID = config.announcementChannelId || config.xpLogChannelId;
const TIMEZONE = "Asia/Jakarta";
// -------------------

const db = admin.firestore();

async function runWeeklyReset(client) {
    console.log('[WeeklySystem] 🔄 Running weekly reset...');

    try {
        const usersRef = db.collection('users');
        const channel = client.channels.cache.get(ANNOUNCE_CHANNEL_ID);

        // 1. FIND CLIMBER OF THE WEEK (Based on weeklyXp)
        const climberSnap = await usersRef.orderBy('weeklyXp', 'desc').limit(1).get();
        let climberName = "None yet";
        let climberPoints = 0;

        if (!climberSnap.empty) {
            const doc = climberSnap.docs[0];
            const data = doc.data();
            if (data.weeklyXp > 0) {
                // Prioritize Discord mention, fallback to Roblox username
                climberName = data.discordId ? `<@${data.discordId}>` : data.robloxUsername;
                climberPoints = data.weeklyXp;
            }
        }

        // 2. FIND HOST OF THE WEEK (Based on weeklyGuidePoints)
        const hostSnap = await usersRef.orderBy('weeklyGuidePoints', 'desc').limit(1).get();
        let hostName = "None yet";
        let hostPoints = 0;

        if (!hostSnap.empty) {
            const doc = hostSnap.docs[0];
            const data = doc.data();
            if (data.weeklyGuidePoints > 0) {
                hostName = data.discordId ? `<@${data.discordId}>` : data.robloxUsername;
                hostPoints = data.weeklyGuidePoints;
            }
        }

        // 3. FIND TOP EXPEDITION (Based on weeklyExpeditions)
        const expeditionSnap = await usersRef.orderBy('weeklyExpeditions', 'desc').limit(1).get();
        let expeditionName = "None yet";
        let expeditionCount = 0;

        if (!expeditionSnap.empty) {
            const doc = expeditionSnap.docs[0];
            const data = doc.data();
            if (data.weeklyExpeditions > 0) {
                expeditionName = data.discordId ? `<@${data.discordId}>` : data.robloxUsername;
                expeditionCount = data.weeklyExpeditions;
            }
        }

        // 4. SEND ANNOUNCEMENT
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('🏆 WEEKLY CHAMPIONS: Mooncrest Expedition 🏆')
                .setDescription('This week has concluded! Weekly statistics have been reset.')
                .setColor('#FFD700') // Gold Color
                .addFields(
                    { name: '🧗 Climber of the Week', value: `${climberName}\n(**${climberPoints}** Weekly LP)`, inline: true },
                    { name: '🎤 Host of the Week', value: `${hostName}\n(**${hostPoints}** Weekly Points)`, inline: true },
                    { name: '🚀 Explorer of the Week', value: `${expeditionName}\n(**${expeditionCount}** Expeditions)`, inline: true }
                )
                .setImage('https://media.discordapp.net/attachments/1435964396408148088/1436712000800428072/temp_voice.png?ex=691099d1&is=690f4851&hm=fd071c2343e1d367ad1ca818ec8ee11c0659a101e2859bbafd0ba782c129c145&') // Use temp image or replace
                .setTimestamp()
                .setFooter({ text: 'Weekly statistics are automatically reset every Monday at 05:00 WIB.' });

            await channel.send({ content: "<@&1417377384197390428>", embeds: [embed] });
        }

        // 4. RESET DATABASE (Batch Update)
        const batch = db.batch();
        let operationCount = 0;

        // Get users with points > 0 to save writes
        const dirtyClimbers = await usersRef.where('weeklyXp', '>', 0).get();
        dirtyClimbers.forEach(doc => {
            batch.update(doc.ref, { weeklyXp: 0 });
            operationCount++;
        });

        const dirtyHosts = await usersRef.where('weeklyGuidePoints', '>', 0).get();
        dirtyHosts.forEach(doc => {
            batch.update(doc.ref, { weeklyGuidePoints: 0 });
            operationCount++;
        });

        const dirtyExpeditions = await usersRef.where('weeklyExpeditions', '>', 0).get();
        dirtyExpeditions.forEach(doc => {
            batch.update(doc.ref, { weeklyExpeditions: 0 });
            operationCount++;
        });

        if (operationCount > 0) {
            await batch.commit();
            console.log(`[WeeklySystem] ✅ Successfully reset ${operationCount} user data.`);
        }

    } catch (error) {
        console.error('[WeeklySystem] ❌ Error:', error);
    }
}

export function initWeeklyScheduler(client) {
    // Schedule: Every Monday at 05:00 WIB
    cron.schedule('0 5 * * 1', () => {
        runWeeklyReset(client);
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });
    console.log('[WeeklySystem] ⏳ Weekly Scheduler Active');
}