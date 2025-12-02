# RobloxHelper - Penjelasan & Cara Pakai

## 🤔 Kenapa Pakai RobloxHelper, Bukan noblox.js?

### ❌ **noblox.js (Rusak)**
```
Cookie → noblox.js validation (GAGAL!) → Roblox API
```
- Ada layer validasi tambahan yang **punya bug**
- Cookie valid **ditolak** sebelum sampai ke Roblox API
- Lebih kompleks, prone to errors

### ✅ **RobloxHelper (Yang Kita Pakai)**
```
Cookie → Axios → Roblox API → Success!
```
- Pakai **axios** untuk HTTP request
- **Langsung** kirim ke Roblox API (official)
- **Tidak ada** validasi berlebihan
- **Sederhana & reliable**

---

## 📦 **Cara Pakai RobloxHelper**

### **1. Import**
```javascript
import RobloxHelper from './helpers/RobloxHelper.js';
```

### **2. Initialize dengan Cookie**
```javascript
// Cookie dari .env atau langsung
const COOKIE = process.env.ROBLOX_COOKIE;

// Buat instance
const roblox = new RobloxHelper(COOKIE);

// Login (initialize)
await roblox.initialize();
```

### **3. Get Current User**
```javascript
const user = roblox.getCurrentUser();

console.log(user.id);          // 9749788777
console.log(user.name);        // mcrsSystem
console.log(user.displayName); // mcrsSystem
```

### **4. Get User Info by ID**
```javascript
const userInfo = await roblox.getUserInfo(9749788777);

console.log(userInfo.name);        // Username
console.log(userInfo.displayName); // Display name
console.log(userInfo.description); // Bio
```

### **5. Get User by Username**
```javascript
const user = await roblox.getUserByUsername('mcrsSystem');

console.log(user.id);              // User ID
console.log(user.name);            // Username
console.log(user.displayName);     // Display name
```

### **6. Get Player Thumbnail (Avatar)**
```javascript
const avatarUrl = await roblox.getPlayerThumbnail(9749788777);

console.log(avatarUrl); // https://tr.rbxcdn.com/...
```

Custom size:
```javascript
const avatarUrl = await roblox.getPlayerThumbnail(
    9749788777,
    '420x420',  // size
    'Png',      // format
    false       // isCircular
);
```

### **7. Get Friends & Followers Count**
```javascript
const stats = await roblox.getPlayerInfo(9749788777);

console.log(stats.friendCount);    // 0
console.log(stats.followerCount);  // 0
```

---

## 🔧 **Available Methods**

| Method | Parameter | Return | Description |
|--------|-----------|--------|-------------|
| `initialize()` | - | `User` | Login & get current user |
| `getCurrentUser()` | - | `User` | Get logged in user |
| `getUserInfo(userId)` | `userId: number` | `User` | Get user by ID |
| `getUserByUsername(username)` | `username: string` | `User` | Get user by username |
| `getPlayerThumbnail(userId, size, format, isCircular)` | `userId: number`<br>`size?: string`<br>`format?: string`<br>`isCircular?: boolean` | `string` (URL) | Get avatar URL |
| `getPlayerInfo(userId)` | `userId: number` | `{friendCount, followerCount}` | Get friends/followers stats |

---

## 💡 **Contoh Penggunaan Lengkap**

```javascript
import RobloxHelper from './helpers/RobloxHelper.js';

async function main() {
    try {
        // Initialize
        const roblox = new RobloxHelper(process.env.ROBLOX_COOKIE);
        await roblox.initialize();
        
        // Get current user
        const currentUser = roblox.getCurrentUser();
        console.log('Logged in as:', currentUser.name);
        
        // Get another user by username
        const targetUser = await roblox.getUserByUsername('builderman');
        
        if (targetUser) {
            console.log('Found user:', targetUser.displayName);
            
            // Get their avatar
            const avatar = await roblox.getPlayerThumbnail(targetUser.id);
            console.log('Avatar URL:', avatar);
            
            // Get their stats
            const stats = await roblox.getPlayerInfo(targetUser.id);
            console.log('Friends:', stats.friendCount);
            console.log('Followers:', stats.followerCount);
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    }
}

main();
```

---

## 🛡️ **Error Handling**

```javascript
try {
    const roblox = new RobloxHelper(cookie);
    await roblox.initialize();
} catch (error) {
    if (error.message.includes('Cookie invalid')) {
        console.log('Cookie expired! Ambil cookie baru.');
    } else {
        console.error('Error lain:', error.message);
    }
}
```

---

## 🔑 **Cara Dapatkan Cookie**

1. Login ke https://www.roblox.com
2. Tekan **F12** (Developer Tools)
3. Tab **Application** > **Cookies** > `https://www.roblox.com`
4. Cari cookie `.ROBLOSECURITY`
5. Copy **seluruh nilai** (termasuk `_|WARNING:...`)
6. Simpan di `.env`:
   ```
   ROBLOX_COOKIE=_|WARNING:-DO-NOT-SHARE-THIS...
   ```

⚠️ **JANGAN share cookie ke siapapun!** Cookie = akses penuh ke account!

---

## 📊 **Perbandingan noblox.js vs RobloxHelper**

| Feature | noblox.js | RobloxHelper |
|---------|-----------|--------------|
| Login | ❌ Gagal (bug) | ✅ Berhasil |
| Get User Info | ✅ | ✅ |
| Get Avatar | ✅ | ✅ |
| Get Friends/Followers | ✅ | ✅ |
| Dependencies | Banyak (88 packages) | Minimal (axios saja) |
| File Size | Besar | Kecil (~7KB) |
| Maintenance | Library eksternal | Kamu yang kontrol |
| Custom | Susah | Mudah dimodifikasi |

---

## ✅ **Kesimpulan**

RobloxHelper adalah **solusi alternatif** yang:
- ✅ **Lebih sederhana** dari noblox.js
- ✅ **Lebih reliable** (langsung ke API)
- ✅ **Lebih ringan** (cuma pakai axios)
- ✅ **Mudah di-custom** sesuai kebutuhan

Pakai RobloxHelper untuk semua kebutuhan Roblox API di project kamu! 🚀
