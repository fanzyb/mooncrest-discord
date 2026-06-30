# 🧠 Mooncrest Bot - Gemini AI Integration

This document outlines the setup, architecture, and features of the **Google Gemini AI** integration within the Mooncrest Discord Bot.

---

## 🛠 Setup & Environment Variables

To enable Gemini AI capabilities, you need to add your API Key to the `.env` file in the root directory:

```env
GEMINI_API_KEY="your_google_gemini_api_key_here"
```

> [!NOTE]
> You can acquire a free or pay-as-you-go API key from the [Google AI Studio](https://aistudio.google.com/).

---

## 🤖 Model & Architecture

*   **API Model**: `gemini-2.5-flash` (used for fast, efficient, and cost-effective text generation and translations).
*   **Endpoint**: Google Generative Language REST API (`https://generativelanguage.googleapis.com/v1beta/`).
*   **Wrapper**: Handled natively in [geminiHandler.js](file:///c:/Users/IRFAN/Project/BOT%20DISCORD%20MOONCREST/src/utils/geminiHandler.js) using the `node-fetch` library.

---

## 🌟 Integrated Gemini AI Features

### 1. Reusable Prompt Wrapper (`generateContent`)
A standard asynchronous function located in [geminiHandler.js](file:///c:/Users/IRFAN/Project/BOT%20DISCORD%20MOONCREST/src/utils/geminiHandler.js) to send prompts with custom system instructions to Gemini:
```javascript
import { generateContent } from "./utils/geminiHandler.js";

const result = await generateContent("Your prompt here", "Optional system instructions here");
```

### 2. 🌍 Bidirectional Translator (`translateText`)
Located in [translationHandler.js](file:///c:/Users/IRFAN/Project/BOT%20DISCORD%20MOONCREST/src/utils/translationHandler.js). It dynamically detects the source language and translates it:
*   Supports bidirectional matching (e.g. translates Indonesian ➡️ English, or English ➡️ Indonesian depending on user input).
*   Configured as a high-fidelity translator with clean output rules (no headers, no meta explanations).

### 3. 💬 Philosophy & Motivation Command (`/quote`)
Slash command defined in [quote.js](file:///c:/Users/IRFAN/Project/BOT%20DISCORD%20MOONCREST/src/commands/quote.js) that generates short, motivational quotes:
*   **Usage**: `/quote [topic]` (Defaults to *Motivation, Stoicism, or Wisdom* if no topic is specified).
*   Uses a system instruction configuring the bot as a wise motivator to deliver short quotes under 280 characters with optional Indonesian translation reflections.

### 4. 🌅 Automatic Daily Quote Scheduler (`initDailyQuote`)
An automated task scheduler in [dailyQuote.js](file:///c:/Users/IRFAN/Project/BOT%20DISCORD%20MOONCREST/src/utils/dailyQuote.js):
*   **Schedule**: Fires every day at **08:00 WIB (Asia/Jakarta)** using `node-cron`.
*   **Output**: Generates a thematic "Quote of the Day" in English accompanied by an Indonesian reflection (`*Refleksi:*`), and broadcasts it to the channel matching `dailyQuoteChannelId` in `config.json`.

---

## 🛠 Adding New Gemini Features
If you want to implement additional AI features (e.g., auto-moderator, ticket answers, or chat systems):
1. Import `generateContent` from `./src/utils/geminiHandler.js`.
2. Craft specialized **System Instructions** to lock down the AI's tone, format rules, and boundaries.
3. Call the API asynchronously and embed/send the clean output back to Discord channels or interactions!
