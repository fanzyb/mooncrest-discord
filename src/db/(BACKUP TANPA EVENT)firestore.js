import admin from "firebase-admin";
// Import file JSON secara langsung
import serviceAccount from "../../firebase-adminsdk.json" with { type: "json" };

let db;
try {
    // Inisialisasi hanya jika belum diinisialisasi
    if (admin.apps.length === 0) {
        admin.initializeApp({
            // Gunakan serviceAccount yang sudah di-import
            credential: admin.credential.cert(serviceAccount)
        });
        console.log("✅ Firebase Admin SDK Initialized from JSON file.");
    }
    db = admin.firestore();
} catch (error) {
    console.error("FATAL: Firebase initialization error. Make sure 'firebase-adminsdk.json' exists and is valid.", error.message || error);
    process.exit(1);
}

const USERS_COLLECTION = "users";

// --- Sisa file firestore.js (SEMUA FUNGSI LAINNYA) tetap sama persis ---
// Tidak perlu mengubah apa pun di bawah baris ini.

/**
 * Menyimpan/memperbarui data pengguna ke Firestore.
 */
export async function saveUser(userData) {
    if (!db) throw new Error("Firestore DB not initialized.");
    if (!userData || !userData.robloxId) throw new Error("Cannot save user data without a robloxId.");
    const docId = userData.robloxId;
    await db.collection(USERS_COLLECTION).doc(docId).set(userData, { merge: true });
    return userData;
}

/**
 * Mencari user di Firestore. Menggunakan robloxId sebagai Document ID.
 */
export async function findUser(robloxId) {
    if (!db) return null;
    const doc = await db.collection(USERS_COLLECTION).doc(robloxId).get();
    if (doc.exists) {
        const data = doc.data();
        return {
            ...data,
            robloxId: doc.id,
            xp: data.xp || 0,
            expeditions: data.expeditions || 0,
            achievements: data.achievements || [],
            discordId: data.discordId || null,
            isVerified: data.isVerified || false,
        };
    }
    return null;
}

/**
 * Mencari user berdasarkan Discord ID.
 */
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
            expeditions: data.expeditions || 0,
            achievements: data.achievements || [],
            discordId: data.discordId || null,
            isVerified: data.isVerified || false,
        };
    }
    return null;
}

/**
 * Menghapus user dari Firestore berdasarkan Roblox ID.
 */
export async function deleteUser(robloxId) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection(USERS_COLLECTION).doc(robloxId).delete();
}

/**
 * Menghitung jumlah dokumen yang memenuhi kriteria (untuk rank).
 */
export async function countUsersWhere(field, operator, value) {
    if (!db) return 0;
    const snapshot = await db.collection(USERS_COLLECTION)
        .where(field, operator, value)
        .count().get();
    return snapshot.data().count;
}

/**
 * Mengambil data untuk leaderboard.
 */
export async function findLeaderboardUsers(sortField, limit, offset) {
    if (!db) return [];
    const snapshot = await db.collection(USERS_COLLECTION)
        .orderBy(sortField, 'desc')
        .orderBy('robloxId', 'asc')
        .limit(limit)
        .offset(offset)
        .get();
    return snapshot.docs.map(doc => doc.data());
}

/**
 * Menghitung total users.
 */
export async function countTotalUsers() {
    if (!db) return 0;
    const snapshot = await db.collection(USERS_COLLECTION).count().get();
    return snapshot.data().count;
}

/**
 * Mengambil semua user (untuk debug/hall-of-fame).
 */
export async function getAllUsers() {
    if (!db) return [];
    const snapshot = await db.collection(USERS_COLLECTION).get();
    return snapshot.docs.map(doc => doc.data());
}

/**
 * Mengambil data milestone yang terakhir diumumkan.
 */
export async function getLastAnnouncedMilestone() {
    if (!db) return 0;
    const doc = await db.collection("metadata").doc('milestones').get();
    if (doc.exists) {
        return doc.data().lastAnnounced || 0;
    }
    return 0;
}

/**
 * Menyimpan data milestone yang baru saja diumumkan.
 */
export async function setLastAnnouncedMilestone(count) {
    if (!db) throw new Error("Firestore DB not initialized.");
    await db.collection("metadata").doc('milestones').set({ lastAnnounced: count });
}