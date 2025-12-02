import admin from "firebase-admin";
import serviceAccount from "../../firebase-adminsdk.json" with { type: "json" };

let db;
try {
    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase Admin SDK Initialized.");
    }
    db = admin.firestore();
} catch (error) {
    console.error("FATAL: Firebase init error.", error);
    process.exit(1);
}

// --- DAFTAR COLLECTION ---
const USERS_COLLECTION = "users";
const EVENT_SUMMIT_COLLECTION = "eventSummitGuides";
const META_COLLECTION = "metadata";
const MOD_LOGS_COLLECTION = "moderation_logs";
const AFK_COLLECTION = "afk_users";
const GIVEAWAYS_COLLECTION = "giveaways"; // Collection Giveaway
const HALL_OF_FAME_COLLECTION = "hall_of_fame_records"; // Hall of Fame Winners

// =========================================
//  👤 USER FUNCTIONS (XP, Weekly, Verify)
// =========================================

export async function saveUser(userData) {
    if (!db) throw new Error("Firestore DB not initialized.");
    if (!userData || !userData.robloxId) throw new Error("No robloxId provided.");
    const docId = userData.robloxId;

    // Use set without merge to properly handle nested object deletions
    // This ensures deleted keys in expeditionHistory and difficultyStats are actually removed
    await db.collection(USERS_COLLECTION).doc(docId).set(userData);
    return userData;
}

export async function findUser(robloxId) {
    if (!db) return null;
    const doc = await db.collection(USERS_COLLECTION).doc(robloxId).get();
    if (doc.exists) {
        const data = doc.data();
        return {
            ...data,
            robloxId: doc.id,
            xp: data.xp || 0,
            weeklyXp: data.weeklyXp || 0,
            weeklyGuidePoints: data.weeklyGuidePoints || 0,
            monthlyXp: data.monthlyXp || 0,
            expeditions: data.expeditions || 0,
            guidePoints: data.guidePoints || 0,
            sarPoints: data.sarPoints || 0,
            achievements: data.achievements || [],
            discordId: data.discordId || null,
            isVerified: data.isVerified || false,
            weeklyExpeditions: data.weeklyExpeditions || 0,
            monthlyExpeditions: data.monthlyExpeditions || 0,
        };
    }
    return null;
}

export async function findUserByDiscordId(discordId) {
    if (!db) return null;
    const snapshot = await db.collection(USERS_COLLECTION)
        .where('discordId', '==', discordId)
        .limit(1)
        .get();
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        return {
            ...data,
            robloxId: doc.id,
            xp: data.xp || 0,
            weeklyXp: data.weeklyXp || 0,
            weeklyGuidePoints: data.weeklyGuidePoints || 0,
            monthlyGuidePoints: data.monthlyGuidePoints || 0,
            expeditions: data.expeditions || 0,
            guidePoints: data.guidePoints || 0,
            sarPoints: data.sarPoints || 0,
            achievements: data.achievements || [],
            discordId: data.discordId || null,
            isVerified: data.isVerified || false,
            weeklyExpeditions: data.weeklyExpeditions || 0,
            monthlyExpeditions: data.monthlyExpeditions || 0,
        };
    }
    return null;
}

export async function deleteUser(robloxId) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection(USERS_COLLECTION).doc(robloxId).delete();
}

export async function countUsersWhere(field, operator, value) {
    if (!db) return 0;
    const snapshot = await db.collection(USERS_COLLECTION).where(field, operator, value).count().get();
    return snapshot.data().count;
}

export async function countTotalUsers() {
    if (!db) return 0;
    const snapshot = await db.collection(USERS_COLLECTION).count().get();
    return snapshot.data().count;
}

export async function getAllUsers() {
    if (!db) return [];
    const snapshot = await db.collection(USERS_COLLECTION).get();
    return snapshot.docs.map(doc => doc.data());
}

export async function findLeaderboardUsers(sortField, limit, offset) {
    if (!db) return [];
    const snapshot = await db.collection(USERS_COLLECTION)
        .orderBy(sortField, 'desc')
        .orderBy('robloxId', 'asc')
        .limit(limit)
        .offset(offset)
        .get();
    return snapshot.docs.map(doc => ({ ...doc.data(), robloxId: doc.id }));
}

// =========================================
//  🎁 GIVEAWAY FUNCTIONS (LENGKAP)
// =========================================

// 1. [FIX] Menyimpan giveaway baru (Ini yang tadi error missing 'saveGiveaway')
export async function saveGiveaway(messageId, data) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection(GIVEAWAYS_COLLECTION).doc(messageId).set(data);
    return data;
}

// 2. Ambil data giveaway
export async function getGiveaway(messageId) {
    if (!db) return null;
    const doc = await db.collection(GIVEAWAYS_COLLECTION).doc(messageId).get();
    if (doc.exists) return doc.data();
    return null;
}

// 3. Update giveaway (misal edit durasi, end, dll)
export async function updateGiveaway(messageId, data) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection(GIVEAWAYS_COLLECTION).doc(messageId).set(data, { merge: true });
    return data;
}

// 4. Tambah peserta
export async function addGiveawayParticipant(messageId, userId) {
    if (!db) throw new Error("Firestore DB not initialized.");
    const giveawayRef = db.collection(GIVEAWAYS_COLLECTION).doc(messageId);
    await giveawayRef.update({
        participants: admin.firestore.FieldValue.arrayUnion(userId)
    });
}

// 5. Ambil list peserta
export async function getGiveawayParticipants(messageId) {
    if (!db) return [];
    const doc = await db.collection(GIVEAWAYS_COLLECTION).doc(messageId).get();
    if (doc.exists) {
        return doc.data().participants || [];
    }
    return [];
}

// 6. Ambil semua giveaway aktif (untuk handling restart bot)
export async function getAllRunningGiveaways() {
    if (!db) return [];
    const snapshot = await db.collection(GIVEAWAYS_COLLECTION)
        .where('ended', '==', false)
        .get();

    return snapshot.docs.map(doc => ({
        messageId: doc.id,
        ...doc.data()
    }));
}

// =========================================
//  💤 AFK FUNCTIONS
// =========================================

export async function saveAfkStatus(userId, guildId, reason, nickname) {
    if (!db) throw new Error("Firestore DB not initialized.");
    const docId = `${guildId}_${userId}`;
    const data = {
        userId,
        guildId,
        reason,
        oldNickname: nickname || null,
        timestamp: Date.now()
    };
    await db.collection(AFK_COLLECTION).doc(docId).set(data);
    return data;
}

export async function getAfkStatus(userId, guildId) {
    if (!db) return null;
    const docId = `${guildId}_${userId}`;
    const doc = await db.collection(AFK_COLLECTION).doc(docId).get();
    if (doc.exists) return doc.data();
    return null;
}

export async function deleteAfkStatus(userId, guildId) {
    if (!db) return;
    const docId = `${guildId}_${userId}`;
    await db.collection(AFK_COLLECTION).doc(docId).delete();
}

// =========================================
//  🏔️ SUMMIT EVENT FUNCTIONS
// =========================================

export async function getSummitGuideData(robloxId) {
    if (!db) return { guideCount: 0 };
    const doc = await db.collection(EVENT_SUMMIT_COLLECTION).doc(robloxId).get();
    if (doc.exists) return doc.data();
    return { guideCount: 0 };
}

export async function saveSummitGuideData(robloxId, data) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection(EVENT_SUMMIT_COLLECTION).doc(robloxId).set(data, { merge: true });
}

export async function findSummitLeaderboard(limit, offset) {
    if (!db) return [];
    const snapshot = await db.collection(EVENT_SUMMIT_COLLECTION)
        .orderBy('guideCount', 'desc')
        .orderBy(admin.firestore.FieldPath.documentId(), 'asc')
        .limit(limit)
        .offset(offset)
        .get();
    return snapshot.docs.map(doc => ({
        robloxId: doc.id,
        guideCount: doc.data().guideCount || 0
    }));
}

// =========================================
//  ⚙️ METADATA & MILESTONE FUNCTIONS
// =========================================

export async function getLastAnnouncedMilestone() {
    if (!db) return 0;
    const doc = await db.collection(META_COLLECTION).doc('milestones').get();
    if (doc.exists) return doc.data().lastAnnounced || 0;
    return 0;
}

export async function setLastAnnouncedMilestone(count) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection(META_COLLECTION).doc('milestones').set({ lastAnnounced: count });
}

// =========================================
//  🛡️ MODERATION & WARNINGS
// =========================================

export async function saveWarning(userId, guildId, moderatorId, reason, caseId) {
    if (!db) throw new Error("Firestore DB not initialized.");
    const warnData = { userId, guildId, moderatorId, reason, caseId, timestamp: admin.firestore.FieldValue.serverTimestamp() };
    await db.collection(MOD_LOGS_COLLECTION).add(warnData);
    return warnData;
}

export async function getWarnings(userId, guildId) {
    if (!db) return [];
    const snapshot = await db.collection(MOD_LOGS_COLLECTION)
        .where('userId', '==', userId).where('guildId', '==', guildId)
        .orderBy('timestamp', 'desc').get();
    if (snapshot.empty) return [];
    return snapshot.docs.map(doc => doc.data());
}

export async function deleteWarningByCaseId(caseId, guildId) {
    if (!db) return null;
    const snapshot = await db.collection(MOD_LOGS_COLLECTION)
        .where('caseId', '==', caseId).where('guildId', '==', guildId).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    const deletedData = doc.data();
    await doc.ref.delete();
    return deletedData;
}

// =========================================
//  🌐 TRANSLATION CHANNELS
// =========================================
const TRANSLATION_COLLECTION = "translation_channels";

export async function saveTranslationChannel(channelId, data) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection(TRANSLATION_COLLECTION).doc(channelId).set(data, { merge: true });
    return data;
}

export async function getTranslationChannel(channelId) {
    if (!db) return null;
    const doc = await db.collection(TRANSLATION_COLLECTION).doc(channelId).get();
    if (doc.exists) return doc.data();
    return null;
}

export async function deleteTranslationChannel(channelId) {
    if (!db) return;
    await db.collection(TRANSLATION_COLLECTION).doc(channelId).delete();
}

export async function getAllTranslationChannels() {
    if (!db) return [];
    const snapshot = await db.collection(TRANSLATION_COLLECTION).get();
    return snapshot.docs.map(doc => ({ channelId: doc.id, ...doc.data() }));
}

// =========================================
//  🏆 HALL OF FAME RECORDS
// =========================================

/**
 * Save a monthly winner (Host or Climber)
 * @param {string} category - "host" or "climber"
 * @param {object} userData - User data with robloxId, robloxUsername, discordId
 * @param {number} month - Month number (1-12)
 * @param {number} year - Year (e.g., 2025)
 * @param {number} value - Points (for host) or Lunar Points (for climber)
 * @param {string} reason - Optional reason for the award
 */
export async function saveMonthlyWinner(category, userData, month, year, value, reason) {
    if (!db) throw new Error("Firestore DB not initialized.");

    // Document ID format: "monthly-YYYY-MM"
    const docId = `monthly-${year}-${String(month).padStart(2, '0')}`;

    // Get existing document if it exists
    const docRef = db.collection(HALL_OF_FAME_COLLECTION).doc(docId);
    const doc = await docRef.get();

    const timestamp = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`);

    let updateData;
    if (category === 'host') {
        updateData = {
            period: 'monthly',
            month: month,
            year: year,
            timestamp: timestamp.toISOString(),
            hostOfTheMonth: {
                robloxId: userData.robloxId,
                robloxUsername: userData.robloxUsername,
                discordId: userData.discordId,
                points: value,
                reason: reason || ''
            }
        };
    } else if (category === 'climber') {
        updateData = {
            period: 'monthly',
            month: month,
            year: year,
            timestamp: timestamp.toISOString(),
            climberOfTheMonth: {
                robloxId: userData.robloxId,
                robloxUsername: userData.robloxUsername,
                discordId: userData.discordId,
                lunarPoints: value,
                reason: reason || ''
            }
        };
    } else {
        throw new Error("Invalid category. Must be 'host' or 'climber'.");
    }

    // Merge with existing data
    await docRef.set(updateData, { merge: true });

    return updateData;
}

/**
 * Save a weekly winner (Host or Climber)
 * @param {string} category - "host" or "climber"
 * @param {object} userData - User data with robloxId, robloxUsername, discordId
 * @param {string} weekStartDate - Week start date in YYYY-MM-DD format
 * @param {number} value - Points (for host) or Lunar Points (for climber)
 * @param {string} reason - Optional reason for the award
 */
export async function saveWeeklyWinner(category, userData, weekStartDate, value, reason) {
    if (!db) throw new Error("Firestore DB not initialized.");

    // Document ID format: "weekly-YYYY-MM-DD"
    const docId = `weekly-${weekStartDate}`;

    // Get existing document if it exists
    const docRef = db.collection(HALL_OF_FAME_COLLECTION).doc(docId);
    const doc = await docRef.get();

    const timestamp = new Date(`${weekStartDate}T00:00:00.000Z`);
    const year = new Date(weekStartDate).getFullYear();

    let updateData;
    if (category === 'host') {
        updateData = {
            period: 'weekly',
            weekStartDate: weekStartDate,
            year: year,
            timestamp: timestamp.toISOString(),
            hostOfTheWeek: {
                robloxId: userData.robloxId,
                robloxUsername: userData.robloxUsername,
                discordId: userData.discordId,
                points: value,
                reason: reason || ''
            }
        };
    } else if (category === 'climber') {
        updateData = {
            period: 'weekly',
            weekStartDate: weekStartDate,
            year: year,
            timestamp: timestamp.toISOString(),
            climberOfTheWeek: {
                robloxId: userData.robloxId,
                robloxUsername: userData.robloxUsername,
                discordId: userData.discordId,
                lunarPoints: value,
                reason: reason || ''
            }
        };
    } else {
        throw new Error("Invalid category. Must be 'host' or 'climber'.");
    }

    // Merge with existing data
    await docRef.set(updateData, { merge: true });

    return updateData;
}

/**
 * Get all Hall of Fame records for a specific period and year
 * @param {string} period - "monthly" or "weekly"
 * @param {number} year - Year to filter by
 * @returns {Array} Array of records sorted by timestamp (newest first)
 */
export async function getHallRecords(period, year) {
    if (!db) return [];

    const snapshot = await db.collection(HALL_OF_FAME_COLLECTION)
        .where('period', '==', period)
        .where('year', '==', year)
        .orderBy('timestamp', 'desc')
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}