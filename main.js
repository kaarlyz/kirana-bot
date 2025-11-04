const TelegramBot = require('node-telegram-bot-api');
const token = '7363365217:AAEPZV_PD2BH9QVIagW2CEEm2Fi34xrxqtU';

// Membuat instance bot
const bot = new TelegramBot(token, {polling: true});

// Menangani perintah /start dan menampilkan menu
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userName = msg.from.first_name || msg.from.username;
  const opts = {
    reply_markup: {
      inline_keyboard: [
        [
          { text: 'CLICK DISINI', callback_data: 'menu' },
        ]
      ]
    }
  };

  bot.sendMessage(
    chatId, 
   `Halo ${userName}! Selamat datang di bot Kirana 🌟\n\n` +
    'Saya siap membantu Anda untuk berbelanja dengan mudah dan nyaman.\n' +
    'Silakan pilih menu di bawah ini:',
    opts
  );
});

// Menangani callback dari inline keyboard
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

  switch(data) {
    case 'menu':
      const menuOpts = {
        reply_markup: {
          inline_keyboard: [
            [
              { text: 'List Roster', callback_data: 'roster' },
              { text: 'Mata Pelajaran', callback_data: 'livemapel' }
            ],
            [
              { text: 'List Tugas', callback_data: 'tugas' },
              { text: 'Upload Tugas', callback_data: 'upload' }
            ],
            [
              {text: 'Jadwal Sekarang', callback_data: 'jadwalsekarang'}
            ]
          ]
        }
      };
      
      bot.sendMessage(
        chatId,
        '📋 *Menu Utama*\n\n' +
        'Silakan pilih menu yang tersedia:',
        { ...menuOpts, parse_mode: 'Markdown' }
      );
      break;

case 'roster':
  bot.sendPhoto(chatId, '../image.png', {caption: '📋 Berikut roster anda',  parse_mode: 'Markdown' });
  break;

    case 'livemapel':
      bot.sendMessage(chatId, 
        'Keranjang belanja Anda masih kosong');
      break;

      case 'jadwalsekarang':
      bot.sendMessage(chatId, 'Jadwal pelajaran anda saat ini adalah ...');
      break;

    case 'tugas':
      bot.sendMessage(chatId, 'Riwayat pesanan Anda kosong');
      break;

    case 'upload':
      bot.sendMessage(chatId, 'Hubungi admin kami di: @admin');
      break;
  }
});

// Menangani pesan biasa
bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  
  if (msg.text && !msg.text.startsWith('/')) {
    bot.sendMessage(chatId, `Anda mengirim pesan: ${msg.text}`);
  }
});

console.log('Bot telah aktif dan siap digunakan!');