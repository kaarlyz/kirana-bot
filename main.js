const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

// Load config
const token = process.env.TELEGRAM_TOKEN || '7363365217:AAEPZV_PD2BH9QVIagW2CEEm2Fi34xrxqtU';

// Ensure uploads dir exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Create bot
const bot = new TelegramBot(token, { polling: true });

// make bot info available for handlers
bot.getMe().then(info => {
  bot.botInfo = info;
}).catch(() => { /* ignore */ });

// Import handlers (each module exports function(bot))
require('./src/handlers/messageHandler')(bot);
require('./src/handlers/commandHandler')(bot);
require('./src/handlers/callbackHandler')(bot);

// Start reminder service if available
try {
  const { startReminderService } = require('./src/services/reminderService');
  startReminderService(bot);
} catch (e) {
  console.warn('Reminder service not started:', e.message);
}

bot.on('polling_error', (err) => console.error('Polling error', err));

console.log('🤖 Bot Kirana telah aktif dan siap digunakan!');
console.log('📝 Log aktivitas user:');