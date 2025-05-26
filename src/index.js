import { Hono } from 'hono';
import TelegramBot from 'node-telegram-bot-api';
const cron = require('node-cron'); // For local development cron jobs

// On Cloudflare Workers, TELEGRAM_BOT_TOKEN should be set as a secret.
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || 'YOUR_TELEGRAM_BOT_TOKEN_PLACEHOLDER';
if (TELEGRAM_BOT_TOKEN === 'YOUR_TELEGRAM_BOT_TOKEN_PLACEHOLDER') {
  console.warn('IMPORTANT: TELEGRAM_BOT_TOKEN is not set in environment variables. Using placeholder.');
}

// Configuration for renew time and reminders
const RENEW_HOUR = 10; // 10 AM UTC
const RENEW_MINUTE = 0;
const REMINDER_OFFSET_MINUTES = 5;

// FOR CLOUDFLARE WORKERS:
// messageStore would need to be replaced with KV Store interactions.
// Example (conceptual):
// async function getChatMessages(chatId, userId) { /* ... get from KV ... */ }
// async function addMessageToStore(chatId, userId, messageData) { /* ... put to KV ... */ }
// async function clearChatMessages(chatId) { /* ... delete from KV ... */ }
// All operations on messageStore would become async and use these functions.
const messageStore = new Map(); // KV: Needs async KV operation (for all uses)

const app = new Hono();

// FOR CLOUDFLARE WORKERS DEPLOYMENT:
// 1. Remove { polling: true }
// 2. Set up a webhook route in Hono:
//    app.post('/api/telegram_webhook', async (c) => {
//      const body = await c.req.json();
//      bot.processUpdate(body);
//      return c.json({ ok: true });
//    });
// 3. Call bot.setWebHook('YOUR_CLOUDFLARE_WORKER_URL/api/telegram_webhook') once on setup.
//    This might be done via a separate script or a special setup route.
const bot = new TelegramBot(TELEGRAM_BOT_TOKEN, { polling: true }); // Keep polling for local dev

let botUsername = '';
bot.getMe().then((me) => { // This is fine for CF, but consider if username is needed at startup or can be fetched on first message
    if (me.username) {
        botUsername = me.username;
        console.log(`Bot username is: @${botUsername}`);
    } else {
        console.error('Bot username is undefined. Mention feature might not work as expected.');
    }
}).catch(err => {
    console.error('Failed to get bot username:', err);
});

app.get('/', (c) => c.json({ message: 'Bot is running!' }));

bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const messageText = msg.text;
    const senderUsername = msg.from.username || 'unknown_user';

    if (!messageText) {
        // Ignore messages without text (e.g., stickers, photos)
        return;
    }

    if (!botUsername) {
        console.log('Bot username not yet fetched, skipping mention check for now.');
        // Optionally, queue message or handle differently
        return;
    }

    if (messageText.includes(`@${botUsername}`)) {
        console.log(`Mention detected in chat ${chatId} from user ${userId} (@${senderUsername})`);

        const actualMessage = messageText.replace(`@${botUsername}`, '').trim();

        if (!actualMessage) {
            bot.sendMessage(chatId, `Hi @${senderUsername}, you mentioned me but didn't provide an update. What's up?`);
            return;
        }

        const messageData = { text: actualMessage, timestamp: new Date() };

        // KV: Needs async KV operation
        if (!messageStore.has(chatId)) {
            // KV: Needs async KV operation
            messageStore.set(chatId, new Map());
        }
        // KV: Needs async KV operation
        const chatMessages = messageStore.get(chatId);

        // KV: Needs async KV operation
        if (!chatMessages.has(userId)) {
            // KV: Needs async KV operation
            chatMessages.set(userId, []);
        }
        // KV: Needs async KV operation
        const userMessages = chatMessages.get(userId);

        userMessages.push(messageData); // KV: This push would be part of an update operation

        bot.sendMessage(chatId, `Thanks for your update, @${senderUsername}!`);

        // Log the current state of messageStore for debugging
        const storeForLogging = {};
        // KV: Needs async KV operation (iterate over keys)
        messageStore.forEach((chatData, currentChatId) => {
            storeForLogging[currentChatId] = {};
            // KV: Needs async KV operation (iterate over keys)
            chatData.forEach((userData, currentUserId) => {
                storeForLogging[currentChatId][currentUserId] = userData;
            });
        });
        console.log('Current messageStore (local Map):', JSON.stringify(storeForLogging, null, 2));
    }
});

// Handler for the /history command
bot.onText(/\/history/, (msg) => {
    const userId = msg.from.id;
    const chatId = msg.chat.id;
    const requesterUsername = msg.from.username || 'unknown_user';

    console.log(`Received /history command from user ${userId} (@${requesterUsername}) in chat ${chatId}.`);

    if (msg.chat.type !== 'private') {
        bot.sendMessage(chatId, "The /history command only works in private chats with me.");
        console.log(`Blocked /history command from user ${userId} in non-private chat ${chatId}.`);
        return;
    }

    let historyText = `Hi @${requesterUsername}, here is your message history:\n\n`;
    let foundHistory = false;

    // KV: Needs async KV operation (iterate over keys for the user across all chats)
    messageStore.forEach((chatMessages, chatIdFromStore) => {
        // KV: Needs async KV operation
        if (chatMessages.has(userId)) {
            // KV: Needs async KV operation
            const userMessages = chatMessages.get(userId);
            if (userMessages.length > 0) {
                foundHistory = true;
                userMessages.forEach(messageData => { // This inner loop is fine if userMessages is an array from KV
                    historyText += `[${new Date(messageData.timestamp).toLocaleString()}] (Chat ID: ${chatIdFromStore}): ${messageData.text}\n`;
                });
            }
        }
    });

    if (!foundHistory) {
        historyText = `Hi @${requesterUsername}, you have no message history recorded with me.`;
    }

    bot.sendMessage(chatId, historyText);
    console.log(`Sent history to user ${userId} (@${requesterUsername}).`);
});

bot.on('polling_error', (error) => {
    console.error('Polling error (local development):', error.code, '-', error.message);
});

// FOR CLOUDFLARE WORKERS:
// This node-cron setup is for local development.
// On Cloudflare, you would use Cron Triggers defined in wrangler.toml.
// The callback functions (for reminder and renewal) would be exported
// and configured as the entry points for these Cron Triggers.
// They would interact with the KV store for message data.
// Example wrangler.toml snippet:
// [[triggers]]
// crons = ["55 9 * * *"] # Example: 9:55 AM UTC for reminder (adjust RENEW_HOUR, RENEW_MINUTE, REMINDER_OFFSET_MINUTES)
// module = "src/index.js" // Assuming direct export from index.js or a separate handler file
// export = "handleReminderCron"
//
// [[triggers]]
// crons = ["0 10 * * *"] # Example: 10:00 AM UTC for renewal
// module = "src/index.js"
// export = "handleRenewalCron"

// The following cron jobs are for local development:
// 1. Daily Renew/Clearing Logic
const renewCronPattern = `${RENEW_MINUTE} ${RENEW_HOUR} * * *`;
cron.schedule(renewCronPattern, () => { // This function would be `handleRenewalCron` for CF
    console.log(`Renewing messages (local cron) at ${new Date().toISOString()}`);
    // KV: Needs async KV operation (iterate over all chat keys to send messages and delete)
    messageStore.forEach((chatData, chatId) => {
        bot.sendMessage(chatId, 'Daily stand-up renewal! Previous messages for this chat have been cleared. Please post your updates for the new period.');
        // KV: Needs async KV operation
        messageStore.delete(chatId);
        console.log(`Deleted messages and chat entry for chat ID (local): ${chatId}`);
    });

    const storeForLoggingAfterClear = {};
    // KV: Needs async KV operation
    messageStore.forEach((chatData, currentChatId) => {
        storeForLoggingAfterClear[currentChatId] = {};
        // KV: Needs async KV operation
        chatData.forEach((userData, currentUserId) => {
            storeForLoggingAfterClear[currentChatId][currentUserId] = userData;
        });
    });
    console.log('MessageStore after daily renew (local Map):', JSON.stringify(storeForLoggingAfterClear, null, 2));
});
console.log(`Scheduled daily message renew job (local cron) with pattern: "${renewCronPattern}"`);

// 2. Daily Reminder Logic
const REMINDER_MINUTE_CALC = (RENEW_MINUTE - REMINDER_OFFSET_MINUTES + 60) % 60;
const REMINDER_HOUR_CALC = RENEW_MINUTE < REMINDER_OFFSET_MINUTES ? (RENEW_HOUR - 1 + 24) % 24 : RENEW_HOUR;
const reminderCronPattern = `${REMINDER_MINUTE_CALC} ${REMINDER_HOUR_CALC} * * *`;

cron.schedule(reminderCronPattern, () => { // This function would be `handleReminderCron` for CF
    console.log(`Running daily reminder check (local cron) at ${new Date().toISOString()}`);
    // KV: Needs async KV operation (iterate over all chat keys)
    messageStore.forEach((chatData, chatId) => {
        // KV: Needs async KV operation for messageStore.has and chatData.size (which would be a count from KV)
        if (messageStore.has(chatId) && chatData.size > 0) {
            bot.sendMessage(chatId, `Friendly reminder: Only ${REMINDER_OFFSET_MINUTES} minutes left to post your daily update! Don't forget to mention @${botUsername}`);
            console.log(`Sent reminder to chat ID (local): ${chatId} as it has ${chatData.size} user(s) with messages.`);
        } else if (messageStore.has(chatId) && chatData.size === 0) {
            console.log(`Skipping reminder for chat ID (local): ${chatId} as it has no messages.`);
        }
    });
});
console.log(`Scheduled daily reminder job (local cron) with pattern: "${reminderCronPattern}"`);

console.log('Telegram Bot initialized for local development (polling)...');

// Hono app is exported directly for Cloudflare Workers.
export default app;
