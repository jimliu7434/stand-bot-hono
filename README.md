# Telegram Daily Stand-up Bot

A Node.js Hono-based Telegram bot for daily stand-up updates.

## Features
- Records messages when mentioned (@bot_username) in a group chat.
- Allows users to view their personal message history via a `/history` command in a private chat with the bot.
- Sends a reminder to groups 5 minutes before the daily "renew time" if updates have been posted.
- Clears stored messages daily at a configurable "renew time" to start a fresh update cycle.

## Prerequisites
- Node.js (v14.x or later recommended)
- npm (usually comes with Node.js)
- A Telegram Bot Token (obtain from BotFather on Telegram)

## Setup & Configuration
1. **Clone the repository (or download the source code):**
   ```bash
   git clone <your_repository_url>
   cd <repository_directory>
   ```
   (Replace `<your_repository_url>` and `<repository_directory>` with actual values if applicable, otherwise this is a template.)
2. **Install dependencies:**
   ```bash
   npm install
   ```
3. **Configure Bot Token:**
   Create a file named `.env` in the root of the project and add your Telegram Bot Token:
   ```env
   TELEGRAM_BOT_TOKEN='YOUR_ACTUAL_TELEGRAM_BOT_TOKEN'
   ```
   Replace `YOUR_ACTUAL_TELEGRAM_BOT_TOKEN` with the token you received from BotFather.

## Running the Bot (Local Development)
```bash
npm start
```
You should see console output indicating the bot has initialized and successfully connected with its username.

## How to Use

### 1. Add Bot to Group
- Add your bot to any Telegram group where you want to collect stand-up updates.

### 2. Submitting Updates
- In a group chat where the bot is a member, type your stand-up message and mention the bot.
- **Example:** `@{your_bot_username} Today I worked on feature X and plan to tackle Y.`
- The bot will reply to confirm it received your update.

### 3. Viewing Personal History
- Open a private chat with the bot.
- Send the command: `/history`
- The bot will reply with a list of all the updates you've submitted via mentions in any group the bot is part of.

### 4. Daily Reminders & Renewal
- **Reminder:** The bot is configured with a daily renew time (default is 10:00 AM UTC, see `RENEW_HOUR` and `RENEW_MINUTE` in `src/index.js`).
  - 5 minutes before this renew time, if any updates have been posted in a group for the current period, the bot will send a reminder message to that group.
- **Renewal:** At the renew time, the bot will send a message to each active group, indicating that the stand-up period is renewed and previous messages for that chat have been cleared. This starts a fresh cycle for updates.

## Deployment to Cloudflare Workers (Notes)
The `src/index.js` file contains comments and placeholders for adapting the bot to run on Cloudflare Workers. Key changes would involve:
- Switching from polling to Telegram webhooks.
- Using Cloudflare KV Store for persistent message storage instead of the in-memory store.
- Using Cloudflare Cron Triggers for scheduled tasks (reminders, renewals) instead of `node-cron`.
Refer to the comments within `src/index.js` for more specific guidance.
