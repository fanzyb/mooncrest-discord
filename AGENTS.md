# 🌙 Mooncrest Bot - Agent Guidelines

This document provides essential information for AI agents working on the Mooncrest Discord Bot codebase.

## 🛠 Commands & Operations

### Build & Run
- **Start Bot:** `npm start` (runs `node index.js`)
- **Deploy Commands:** Slash commands are automatically deployed to the guild specified in `config.json` upon startup in `index.js`.
- **Install Dependencies:** `npm install`

### Testing
- **Run a Single Command Script:** `node src/commands/<command_name>.js` (Note: Most commands require a Discord interaction context and won't run standalone).
- **Manual Testing:** For database logic, use standalone test scripts like `test-rank-system.js`.
- **Debugging:** Use `node debug-apikey.js` to verify environment variables.

### Environment Setup
- Ensure `.env` exists with `TOKEN`, `GUILD_ID`, `CLIENT_ID`, `GEMINI_API_KEY`, and `ROBLOX_COOKIE`.
- `firebase-adminsdk.json` must be present in the root for Firestore access.

---

## 🎨 Code Style Guidelines

### 📦 Imports & Modules
- **Type:** ES Modules (`"type": "module"` in `package.json`).
- **Standard:** Use `import` instead of `require`.
- **JSON Imports:** Use the syntax `import config from "./config.json" with { type: "json" };`.
- **Absolute Paths:** Not used; use relative paths for internal modules (e.g., `../utils/helpers.js`).

### 🔧 Formatting
- **Indentation:** 4 spaces.
- **Quotes:** Double quotes for strings where possible.
- **Semi-colons:** Always use semi-colons.
- **Naming Conventions:**
  - **Variables/Functions:** `camelCase` (e.g., `userData`, `saveUser`).
  - **Files:** `kebab-case` or `camelCase` (consistency varies, prefer existing file pattern).
  - **Constants:** `UPPER_SNAKE_CASE` (e.g., `USERS_COLLECTION`).

### 🧱 Architecture
- **Command Handlers:** Located in `src/commands/`. Each file must export `data` (SlashCommandBuilder) and an `execute` function.
- **Database:** All Firestore logic must reside in `src/db/firestore.js`. Never call Firebase directly from commands.
- **Utilities:** Reusable logic (Roblox API calls, level calculations) should be in `src/utils/helpers.js` or specific handlers.
- **AI Logic:** Gemini AI interactions are managed in `src/utils/geminiHandler.js` and integrated in `index.js`.

### ⚠️ Error Handling
- **Commands:** Use `try...catch` blocks. Call `logError(error, interaction, "command_name")` from `src/utils/errorLogger.js` for consistent logging.
- **Interactions:** Always check if an interaction has been deferred or replied to before sending a response (`interaction.editReply` vs `interaction.reply`).

### 💾 Database Schema (Firestore)
- **Users Collection:** Keyed by `robloxId` (string).
- **Fields:** `xp`, `weeklyXp`, `monthlyXp`, `expeditions`, `discordId`, `isVerified`, `achievements`, `expeditionHistory` (map), `difficultyStats` (map).

---

## 🤖 Agent Instructions

1. **Safety First:** NEVER commit `.env`, `firebase-adminsdk.json`, or `src/config.json`.
2. **Persistence:** Use `saveUser(user)` in `src/db/firestore.js` to persist any changes to user stats.
3. **Consistency:** When adding new slash commands, follow the pattern in `src/commands/xp.js`.
4. **Integration:** If adding features requiring AI, leverage the existing Gemini setup in `index.js`.
5. **Auto-Rank Sync:** When modifying XP, remember to call `syncRobloxRank` to keep the Roblox group in sync.

---

## 📝 Rules & Instructions
- No `.cursorrules` or `.github/copilot-instructions.md` were found in this repository. Follow the standards defined here as the primary source of truth.
