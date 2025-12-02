# 🌙 Mooncrest Discord Bot

Discord bot untuk mengelola sistem **Lunar Points (XP)**, **ranking system**, **expedition tracking**, dan berbagai fitur community management untuk Roblox group.

---

## ✨ Fitur Utama

### 🎯 XP & Ranking System
- **Multi-command XP Management** (`/xp`, `/xpd`, `/batch`)
  - `/xp` - Manage XP by Roblox username
  - `/xpd` - Manage XP by Discord mention
  - `/batch` - Bulk XP management for multiple users/roles
- **Expedition Tracking** - Mountain history & difficulty statistics
- **Auto Rank Sync** - Automatic Roblox group rank synchronization
- **Weekly & Monthly Leaderboards** - Auto-reset tracking periods

### 🏆 Achievement & Leaderboard
- **Hall of Fame** - Achievement-based records
- **Hall of Fame Records** - Historical weekly/monthly winners
- **Multiple Leaderboards** - All-time, Weekly, Monthly, Guide Points

### 👥 User Management
- **Roblox Verification** (`/verify`, `/link`)
- **Profile Updates** (`/update`, `/updateprofile`)
- **Auto Role Assignment** - Based on rank/level

### 🎁 Reward System
- **Guide Points** (`/guide`, `/reward`)
- **Giveaway System** (`/giveaway`)
- **Custom Rewards** with role-based permissions

### 🌐 Translation & Communication
- **Real-time Translation** (DeepL API)
- **Voice TTS** (`/say`) - Multi-language support
- **Temporary Voice Channels** - Auto-create/delete
- **Ticket System** with transcript support

### 🛠️ Moderation
- Kick, Ban, Mute, Warn
- Message purge, Slowmode
- Lock/Unlock channels
- User info & moderation history

---

## 📦 Installation

### Prerequisites
- Node.js v18 or higher
- Discord Bot Token
- Firebase Project (Firestore)
- Roblox Open Cloud API Key (optional, for rank sync)

### Setup Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/mooncrest-bot.git
   cd mooncrest-bot
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```
   
   Required variables:
   - `TOKEN` - Discord bot token
   - `CLIENT_ID` - Discord application client ID
   - `ROBLOX_API_KEY` - Roblox Open Cloud API key (for rank sync)
   - `DEEPL_API_KEY` - DeepL API key (for translation)
   - `GEMINI_API_KEY` - Google Gemini API key (optional)

4. **Configure server settings**
   
   Copy `config.json.example` to `src/config.json`:
   ```bash
   cp config.json.example src/config.json
   ```
   
   Fill in your Discord server IDs, role IDs, and mountain list.

5. **Setup Firebase**
   
   - Create a Firebase project
   - Enable Firestore Database
   - Download service account key JSON
   - Save as `firebase-adminsdk.json` in root directory
   - **⚠️ NEVER commit this file to Git!**

6. **Deploy slash commands**
   ```bash
   node index.js
   ```

---

## 📁 Project Structure

```
├── src/
│   ├── commands/         # Slash commands
│   ├── db/              # Firestore database operations
│   ├── events/          # Discord event handlers
│   ├── schedulers/      # Weekly/monthly reset handlers
│   ├── utils/           # Helper functions
│   └── config.json      # Server configuration
├── tools/               # Gemini AI tools
├── .env                 # Environment variables (NOT in Git)
├── firebase-adminsdk.json  # Firebase credentials (NOT in Git)
└── index.js            # Main bot entry point
```

---

## 🎮 Main Commands

### XP Management
- `/xp add/remove/set/bonus [username] [amount]` - Manage XP by Roblox username
- `/xpd add/remove/set/bonus [@user] [amount]` - Manage XP by Discord mention
- `/batch add/remove/set/bonus [targets] [amount]` - Bulk XP operations

### User Info
- `/rank [username]` - Check user rank & XP
- `/stats` - View your expedition statistics
- `/leaderboard [type]` - View various leaderboards

### Verification
- `/verify [username]` - Link Roblox account
- `/link [username] [@user]` - Admin link user to Roblox
- `/update` - Update your Roblox profile
- `/sync` - Manual rank sync

### Rewards
- `/guide add/remove [@user] [points]` - Manage Guide Points
- `/reward` - Admin-only reward distribution

### Hall of Fame
- `/hall-of-fame` - View achievement records
- `/hall-records` - View historical winners
- `/monthly-winner` - Record monthly winners (admin)
- `/weekly-winner` - Record weekly winners (admin)

---

## 🔐 Security Notes

**NEVER commit these files to GitHub:**
- `.env` - Contains API keys and tokens
- `firebase-adminsdk.json` - Firebase service account credentials
- `src/config.json` - Contains your server/role IDs

These files are already in `.gitignore`. Always use the `.example` versions as templates.

---

## 📝 Database Schema (Firestore)

### Users Collection
```javascript
{
  robloxId: string,
  robloxUsername: string,
  discordId: string,
  xp: number,
  weeklyXp: number,
  monthlyXp: number,
  expeditions: number,
  weeklyExpeditions: number,
  monthlyExpeditions: number,
  expeditionHistory: { [mountainName]: count },
  difficultyStats: { [difficulty]: count },
  guidePoints: number,
  achievements: array,
  isVerified: boolean
}
```

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

---

## 📄 License

This project is licensed under the MIT License.

---

## 🙏 Credits

Built with ❤️ for the Mooncrest community
