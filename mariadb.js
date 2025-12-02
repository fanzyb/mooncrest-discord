import admin from "firebase-admin";
import mysql from "mysql2/promise"; // <-- Tetap pakai 'mysql2'
import dotenv from "dotenv";

// 1. Muat kredensial
dotenv.config();
import serviceAccount from "./firebase-adminsdk.json" with { type: "json" };

// Koleksi dari firestore.js
const COLLECTIONS_TO_BACKUP = ["users", "eventSummitGuides", "metadata", "moderation_logs"];

// --- 2. Definisi Schema MariaDB/MySQL ---
// (Schema ini tetap sama persis)
const schemas = {
    users: `
        CREATE TABLE users (
            robloxId VARCHAR(255) PRIMARY KEY,
            robloxUsername VARCHAR(255),
            xp INT DEFAULT 0,
            expeditions INT DEFAULT 0,
            guidePoints INT DEFAULT 0,
            sarPoints INT DEFAULT 0,
            discordId VARCHAR(255),
            isVerified BOOLEAN DEFAULT FALSE,
            achievements JSON
        );
    `,
    eventSummitGuides: `
        CREATE TABLE eventSummitGuides (
            robloxId VARCHAR(255) PRIMARY KEY,
            guideCount INT DEFAULT 0
        );
    `,
    metadata: `
        CREATE TABLE metadata (
            doc_id VARCHAR(255) PRIMARY KEY,
            lastAnnounced INT DEFAULT 0,
            messageId VARCHAR(255) 
        );
    `,
    moderation_logs: `
        CREATE TABLE moderation_logs (
            doc_id VARCHAR(255) PRIMARY KEY,
            caseId VARCHAR(255),
            guildId VARCHAR(255),
            moderatorId VARCHAR(255),
            reason TEXT,
            timestamp DATETIME,
            userId VARCHAR(255)
        );
    `
};

// --- Fungsi Utama ---
async function runBackup() {
    // --- 3. Inisialisasi Firebase ---
    console.log("Connecting to Firebase...");
    try {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (e) {
        if (e.code !== 'app/duplicate-app') throw e;
    }
    const firestoreDb = admin.firestore();
    console.log("✅ Connected to Firebase.");

    // --- 4. Inisialisasi MariaDB (DIPERBARUI) ---
    let mysqlConnection;
    try {
        const mariadbUri = process.env.MARIADB_URI; // <-- Ambil URI
        if (!mariadbUri) {
            console.error("FATAL: MARIADB_URI not found in .env file.");
            return;
        }

        // Gunakan URI langsung untuk koneksi
        mysqlConnection = await mysql.createConnection(mariadbUri); 
        
        console.log("✅ Connected to MariaDB/MySQL.");
    } catch (e) {
        console.error("FATAL: Could not connect to MariaDB/MySQL.", e.message);
        return;
    }
    // --- (AKHIR PERUBAHAN) ---

    // --- 5. Proses Backup ---
    try {
        console.log("\nStarting backup process...");

        for (const collectionName of COLLECTIONS_TO_BACKUP) {
            console.log(`\n--- Backing up collection: '${collectionName}' ---`);
            
            if (!schemas[collectionName]) {
                console.warn(`SKIPPING: No schema defined for collection '${collectionName}'.`);
                continue;
            }

            const snapshot = await firestoreDb.collection(collectionName).get();
            if (snapshot.empty) {
                console.log("No documents found. Skipping.");
                continue;
            }

            try {
                await mysqlConnection.execute(`DROP TABLE IF EXISTS ${collectionName};`);
                await mysqlConnection.execute(schemas[collectionName]);
                console.log(`Table '${collectionName}' created.`);
            } catch (e) {
                console.error(`FATAL: Could not create table for '${collectionName}'.`, e.message);
                continue; 
            }

            console.log(`Found ${snapshot.size} documents. Preparing data...`);
            let insertCount = 0;
            
            for (const doc of snapshot.docs) {
                const data = doc.data();
                
                try {
                    // (Logika insert data tidak berubah)
                    if (collectionName === "users") {
                        const achievementsJson = JSON.stringify(data.achievements || []);
                        await mysqlConnection.query(
                            'INSERT INTO users (robloxId, robloxUsername, xp, expeditions, guidePoints, sarPoints, discordId, isVerified, achievements) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [ doc.id, data.robloxUsername, data.xp, data.expeditions, data.guidePoints, data.sarPoints, data.discordId, data.isVerified, achievementsJson ]
                        );
                    } else if (collectionName === "eventSummitGuides") {
                        await mysqlConnection.query(
                            'INSERT INTO eventSummitGuides (robloxId, guideCount) VALUES (?, ?)',
                            [ doc.id, data.guideCount || 0 ]
                        );
                    } else if (collectionName === "metadata") {
                        await mysqlConnection.query(
                            'INSERT INTO metadata (doc_id, lastAnnounced, messageId) VALUES (?, ?, ?)',
                            [ doc.id, data.lastAnnounced || 0, data.messageId || null ]
                        );
                    } else if (collectionName === "moderation_logs") {
                        await mysqlConnection.query(
                            'INSERT INTO moderation_logs (doc_id, caseId, guildId, moderatorId, reason, timestamp, userId) VALUES (?, ?, ?, ?, ?, ?, ?)',
                            [ doc.id, data.caseId, data.guildId, data.moderatorId, data.reason, data.timestamp ? data.timestamp.toDate() : null, data.userId ]
                        );
                    }
                    insertCount++;
                } catch (insertError) {
                    console.warn(`Failed to insert document ${doc.id}: ${insertError.message}`);
                }
            }
            console.log(`✅ Successfully inserted ${insertCount} documents into MariaDB.`);
        }

        console.log("\n--- Backup Complete! ---");

    } catch (error) {
        console.error("\n--- ERROR DURING BACKUP ---", error);
    } finally {
        // --- 6. Tutup Koneksi ---
        await mysqlConnection.end();
        console.log("Disconnected from MariaDB/MySQL.");
    }
}

// Jalankan fungsi
runBackup();