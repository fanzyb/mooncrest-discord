# 🌙 Mooncrest Discord Bot

A comprehensive Discord bot designed for **Mooncrest** to manage **Lunar Points (XP)**, **ranking systems**, **expedition tracking**, and **Roblox group synchronization**.

---

## ✨ Key Features

### 🎯 XP & Ranking System

- **Advanced XP Management**: Tools for adding, removing, or setting XP (`/xp`, `/xpd`, `/batch`).
- **Auto Rank Sync**: Automatically synchronizes Discord roles with Roblox group ranks.
- **Expedition Tracking**: Tracks user participation in mountain expeditions and difficulty statistics.
- **Leaderboards**: Weekly, monthly, and all-time leaderboards with auto-reset capabilities.

### 👥 User Management

- **Roblox Verification**: Securely links Discord accounts to Roblox users (`/verify`, `/link`).
- **Profile Updates**: Keeps user data synced (`/update`, `/updateprofile`).
- **Auto-Role Application**: Automatically assigns roles based on accumulated XP.

### 🎁 Rewards & Achievements

- **Guide Points System**: Tracks contributions from community guides.
- **Hall of Fame**: Records achievements and historical winners (`/hall-of-fame`, `/hall-records`).
- **Giveaway System**: Integrated giveaway management.

### 🌐 Community & AI

- **AI Translation**: Real-time translation powered by Google Gemini (`/translate`).
- **Daily Quotes**: AI-generated motivational quotes (`/quote`).
- **Ticket System**: Support ticket management with transcript logging.
- **Temp Voice Channels**: dynamic voice channel creation.

---

## 📦 Installation

### Prerequisites

- **Node.js** (v18 or higher)
- **Firebase Project** (Firestore Database)
- **Roblox Open Cloud API Key** (for group interactions)
- **Gemini API Key** (optional, for AI features)

### Setup Steps

1. **Clone the repository**

   ```bash
   git clone https://github.com/fanzirfan/mooncrest-discord.git
   cd mooncrest-discord
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment Configuration**
   Create a `.env` file in the root directory (copied from `.env.example`) and fill in your credentials:

   ```env
   TOKEN=your_discord_bot_token
   GUILD_ID=your_server_id
   CLIENT_ID=your_bot_client_id
   GEMINI_API_KEY=your_google_gemini_key
   ROBLOX_OPENCLOUD_API_KEY=your_roblox_api_key
   MONGO_URI=your_mongodb_connection_string
   ```

4. **Firebase Setup**
   - Create a project in the [Firebase Console](https://console.firebase.google.com/).
   - Generate a **Service Account Key** (JSON).
   - Rename the file to `firebase-adminsdk.json`.
   - Place it in the **root directory** of the project.
   - _Note: This file contains sensitive keys. DONT commit it to version control._

5. **Bot Configuration**
   - Ensure `src/config.json` exists and is properly configured.
   - This file controls **Role IDs**, **Channel IDs**, **XP levels**, and **Mountain lists**.
   - Review the file to match your server's channels and roles.

6. **Start the Bot**
   ```bash
   npm start
   ```

### 👨‍💻 Development & Linting

To check for code style issues or errors:

```bash
npm run lint
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
├── tools/               # Utility scripts
├── .env                 # Environment variables (NOT in Git)
├── firebase-adminsdk.json  # Firebase credentials (NOT in Git)
├── eslint.config.js     # ESLint configuration
└── index.js             # Main bot entry point
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
