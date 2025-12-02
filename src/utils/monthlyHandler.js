import cron from "node-cron";
import { EmbedBuilder } from "discord.js";
import admin from "firebase-admin";
import config from "../config.json" with { type: "json" };

const ANNOUNCE_CHANNEL_ID = config.announcementChannelId || config.xpLogChannelId;
const TIMEZONE = "Asia/Jakarta";

const db = admin.firestore();

async function runMonthlyReset(client) {
    console.log('[MonthlySystem] 🔄 Running MONTHLY reset...');

    try {
        const usersRef = db.collection('users');
        const channel = client.channels.cache.get(ANNOUNCE_CHANNEL_ID);

        // 1. Find Climber of the Month
        const climberSnap = await usersRef.orderBy('monthlyXp', 'desc').limit(1).get();
        let climberName = "None yet";
        let climberPoints = 0;

        if (!climberSnap.empty) {
            const doc = climberSnap.docs[0];
            const data = doc.data();
            if (data.monthlyXp > 0) {
                climberName = data.discordId ? `<@${data.discordId}>` : data.robloxUsername;
                climberPoints = data.monthlyXp;
            }
        }

        // 2. Find Host of the Month
        const hostSnap = await usersRef.orderBy('monthlyGuidePoints', 'desc').limit(1).get();
        let hostName = "None yet";
        let hostPoints = 0;

        if (!hostSnap.empty) {
            const doc = hostSnap.docs[0];
            const data = doc.data();
            if (data.monthlyGuidePoints > 0) {
                hostName = data.discordId ? `<@${data.discordId}>` : data.robloxUsername;
                hostPoints = data.monthlyGuidePoints;
            }
        }

        // 3. Find Explorer of the Month
        const expeditionSnap = await usersRef.orderBy('monthlyExpeditions', 'desc').limit(1).get();
        let expeditionName = "None yet";
        let expeditionCount = 0;

        if (!expeditionSnap.empty) {
            const doc = expeditionSnap.docs[0];
            const data = doc.data();
            if (data.monthlyExpeditions > 0) {
                expeditionName = data.discordId ? `<@${data.discordId}>` : data.robloxUsername;
                expeditionCount = data.monthlyExpeditions;
            }
        }

        // 4. Send Announcement
        if (channel) {
            const embed = new EmbedBuilder()
                .setTitle('🌕 MONTHLY LEGENDS: Mooncrest Expedition 🌕')
                .setDescription('This month has concluded! Here are our greatest heroes of the month:')
                .setColor('#FFD700')
                .addFields(
                    { name: '🧗 Climber of the Month', value: `${climberName}\n(**${climberPoints}** Monthly LP)`, inline: true },
                    { name: '🎤 Host of the Month', value: `${hostName}\n(**${hostPoints}** Monthly Points)`, inline: true },
                    { name: '🚀 Explorer of the Month', value: `${expeditionName}\n(**${expeditionCount}** Expeditions)`, inline: true }
                )
                .setImage('https://media.discordapp.net/attachments/YOUR_MONTHLY_BANNER.png') // Change monthly banner
                .setTimestamp()
                .setFooter({ text: 'Monthly statistics have been reset.' });

            await channel.send({ content: "<@&1417377384197390428>", embeds: [embed] });
        }

        // 4. RESET DATABASE (Batch Update)
        const batch = db.batch();
        let operationCount = 0;

        // Reset Monthly XP
        const dirtyClimbers = await usersRef.where('monthlyXp', '>', 0).get();
        dirtyClimbers.forEach(doc => {
            batch.update(doc.ref, { monthlyXp: 0 });
            operationCount++;
        });

        // Reset Monthly Guide Points
        const dirtyHosts = await usersRef.where('monthlyGuidePoints', '>', 0).get();
        dirtyHosts.forEach(doc => {
            batch.update(doc.ref, { monthlyGuidePoints: 0 });
            operationCount++;
        });

        const dirtyExpeditions = await usersRef.where('monthlyExpeditions', '>', 0).get();
        dirtyExpeditions.forEach(doc => {
            batch.update(doc.ref, { monthlyExpeditions: 0 });
            operationCount++;
        });

        if (operationCount > 0) {
            await batch.commit();
            console.log(`[MonthlySystem] ✅ Successfully reset ${operationCount} users (Monthly).`);
        }

    } catch (error) {
        console.error('[MonthlySystem] ❌ Error:', error);
    }
}

export function initMonthlyScheduler(client) {
    // Schedule: 1st of every month at 05:00 WIB
    cron.schedule('0 5 1 * *', () => {
        runMonthlyReset(client);
    }, {
        scheduled: true,
        timezone: TIMEZONE
    });
    console.log('[MonthlySystem] ⏳ Monthly Scheduler Active (Resets on the 1st)');
}