# 📂 Panduan Konfigurasi OAuth2 Member Migration & Profile Widget

Panduan ini berisi langkah-langkah detail untuk mengaktifkan fitur **Profile Widget V2** dan **Member Migration (Otomatis Masuk Server Baru)** menggunakan Discord OAuth2.

---

## 🛠️ Langkah 1: Konfigurasi di Discord Developer Portal

1. Buka [Discord Developer Portal](https://discord.com/developers/applications).
2. Pilih aplikasi Bot Anda (**Mooncrest Expedition**).
3. Masuk ke menu **OAuth2** di sidebar kiri.
4. Di bagian **Client Secret**, klik **Reset Secret** lalu **Copy** kode secret yang dihasilkan.
5. Di bagian **Redirects**, klik **Add Redirect** dan masukkan dua URL berikut:
   * `http://localhost:3000/callback` (Untuk fitur migrasi server lokal)
   * `https://discord.com/oauth2/authorized` (Untuk fallback widget-only)
6. Klik **Save Changes** di bagian bawah halaman.

---

## 🔑 Langkah 2: Konfigurasi File `.env`

Buka file `.env` di VS Code/editor Anda, lalu tambahkan variabel berikut di baris paling bawah:

```env
CLIENT_SECRET="PASTE_CLIENT_SECRET_DARI_PORTAL_DI_SINI"
PORT=3000
```

> [!IMPORTANT]
> Jangan bagikan file `.env` atau `CLIENT_SECRET` Anda kepada siapa pun karena kode ini bersifat rahasia.

---

## 🚀 Langkah 3: Jalankan & Otorisasi Akun

1. Matikan bot (jika sedang berjalan) di terminal menggunakan tombol tombol **Ctrl + C**.
2. Nyalakan kembali bot Anda:
   ```bash
   npm start
   ```
   *Pastikan muncul log:* `[OAuthServer] OAuth callback server listening on http://localhost:3000/callback`
3. Buka aplikasi Discord Anda, lalu ketik perintah `/widget link`.
4. Klik link otorisasi yang diberikan oleh bot.
5. Klik **Authorize** pada halaman persetujuan Discord.
6. Browser akan membuka halaman sukses lokal berwarna hijau bertuliskan **"Authorization Successful!"**. 
7. Tutup browser Anda. Token migrasi dan stats widget Anda kini telah tersimpan otomatis di database Firestore.

---

## 🔄 Langkah 4: Melakukan Migrasi Server (Khusus Admin)

Jika di kemudian hari Anda ingin memindahkan seluruh member yang sudah ter-otorisasi ke server Discord baru Anda:

1. Pastikan bot Anda sudah masuk/diundang ke server Discord baru tersebut dengan hak akses **Create Instant Invite**.
2. Jalankan perintah berikut di Discord:
   ```bash
   /widget migrate guild_id:ID_SERVER_BARU_ANDA
   ```
3. Bot akan mulai menambahkan seluruh member ter-otorisasi ke server baru secara otomatis. Kemajuan pemindahan akan ditampilkan di Discord.
