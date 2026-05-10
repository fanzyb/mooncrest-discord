# 🌙 Panduan Setup Bot Discord Mooncrest

Dokumentasi ini memberikan instruksi langkah demi langkah yang sangat rinci untuk mengatur dan menjalankan **Bot Discord Mooncrest** di lingkungan lokal atau server Anda.

---

## 📋 Prasyarat

Sebelum memulai, pastikan Anda telah menginstal perangkat lunak berikut:

1.  **Node.js (v18.x atau lebih tinggi)**: [Unduh di sini](https://nodejs.org/)
2.  **Git**: [Unduh di sini](https://git-scm.com/)
3.  **Editor Kode**: Disarankan menggunakan [Visual Studio Code](https://code.visualstudio.com/)

---

## 🚀 Langkah 1: Persiapan Repositori

1.  Buka terminal atau command prompt Anda.
2.  Clone repositori ini (jika belum):
    ```bash
    git clone https://github.com/fanzirfan/mooncrest-discord.git
    ```
3.  Masuk ke direktori proyek:
    ```bash
    cd mooncrest-discord
    ```
4.  Instal semua dependensi yang diperlukan:
    ```bash
    npm install
    ```

---

## 🛠️ Langkah 2: Konfigurasi API & Token

### 1. Discord Developer Portal
1.  Buka [Discord Developer Portal](https://discord.com/developers/applications).
2.  Buat aplikasi baru (New Application) dan beri nama.
3.  Buka tab **Bot**:
    *   Klik **Reset Token** untuk mendapatkan bot token Anda. Simpan token ini.
    *   Aktifkan **Message Content Intent**, **Server Members Intent**, dan **Presence Intent** di bawah bagian "Privileged Gateway Intents".
4.  Buka tab **OAuth2**:
    *   Salin **Client ID** aplikasi Anda.
5.  Dapatkan **Guild ID** (ID Server):
    *   Di Discord, aktifkan Developer Mode (User Settings > Advanced > Developer Mode).
    *   Klik kanan pada server Anda dan pilih **Copy Server ID**.

### 2. Firebase (Firestore Database)
Bot ini menggunakan Firestore untuk menyimpan data user.
1.  Buka [Firebase Console](https://console.firebase.google.com/).
2.  Buat proyek baru.
3.  Di menu samping, buka **Build > Firestore Database** dan klik **Create Database**. Pilih mode produksi atau pengujian.
4.  Buka **Project Settings** (ikon gerigi) > **Service Accounts**.
5.  Klik **Generate New Private Key**. File JSON akan terunduh.
6.  **PENTING**: Ganti nama file tersebut menjadi `firebase-adminsdk.json` dan letakkan di **root folder** proyek (folder utama).

### 3. Roblox Open Cloud API
Digunakan untuk sinkronisasi rank grup Roblox.
1.  Buka [Roblox Creator Dashboard](https://create.roblox.com/dashboard/credentials).
2.  Pilih **Cloud Keys** > **Create API Key**.
3.  Konfigurasikan API Key:
    *   **Permissions**: Tambahkan API untuk **Groups**. Pastikan memiliki izin untuk membaca dan mengubah rank member.
    *   **Experience Operations**: Jika perlu.
    *   **IP Addresses**: Masukkan `0.0.0.0/0` untuk akses dari mana saja, atau IP spesifik server Anda.
4.  Salin API Key yang dihasilkan.

### 4. Google Gemini AI
Digunakan untuk fitur kutipan harian dan terjemahan.
1.  Buka [Google AI Studio](https://aistudio.google.com/).
2.  Buat **API Key** baru.

---

## 📄 Langkah 3: Konfigurasi File Lingkungan (.env)

1.  Salin file `.env.example` dan ubah namanya menjadi `.env`.
    ```bash
    cp .env.example .env
    ```
2.  Buka file `.env` dan isi dengan data yang telah Anda kumpulkan:

```env
# Discord Configuration
TOKEN=TOKEN_BOT_ANDA
GUILD_ID=ID_SERVER_ANDA
CLIENT_ID=ID_CLIENT_BOT_ANDA

# Gemini AI API
GEMINI_API_KEY=KEY_GEMINI_ANDA

# Roblox Open Cloud API
ROBLOX_OPENCLOUD_API_KEY=KEY_ROBLOX_ANDA
```

---

## ⚙️ Langkah 4: Konfigurasi Bot (src/config.json)

File `src/config.json` mengontrol perilaku bot di server Anda (ID Role, ID Channel, dll).

1.  Buka `src/config.json`.
2.  Pastikan `guildId` dan `groupId` sudah benar.
3.  Update semua ID Channel (seperti `xpLogChannelId`, `errorLogChannelId`, dll) dengan ID channel yang ada di server Anda.
4.  Update `rankToRoleMapping` dan `levels` agar sesuai dengan struktur rank di grup Roblox dan role di server Discord Anda.

---

## 🏃 Langkah 5: Menjalankan Bot

Setelah semua konfigurasi selesai, Anda bisa menjalankan bot dengan perintah:

```bash
npm start
```

Bot akan secara otomatis:
1.  Terhubung ke Discord.
2.  Mendaftarkan (deploy) semua Slash Commands ke server yang ditentukan di `GUILD_ID`.
3.  Menginisialisasi koneksi ke Firebase Firestore.
4.  Mulai menjalankan scheduler (weekly/monthly reset).

---

## 🔍 Troubleshooting (Masalah Umum)

*   **Command tidak muncul?** Pastikan `CLIENT_ID` dan `GUILD_ID` di `.env` sudah benar, lalu restart bot.
*   **Error Firebase?** Pastikan file `firebase-adminsdk.json` ada di root folder dan isinya valid.
*   **Gagal Update Rank Roblox?** Pastikan API Key Roblox memiliki permission "Groups" yang benar dan bot memiliki rank yang cukup tinggi di grup untuk mengubah rank orang lain.
*   **Error Node.js?** Pastikan Anda menggunakan Node.js versi 18 atau lebih baru. Gunakan `node -v` untuk mengecek.

---

## 🛡️ Catatan Keamanan

**JANGAN PERNAH** membagikan atau meng-commit file berikut ke GitHub/Public:
*   `.env`
*   `firebase-adminsdk.json`
*   `src/config.json` (Jika berisi data sensitif)

File-file ini sudah masuk dalam `.gitignore` secara default.
