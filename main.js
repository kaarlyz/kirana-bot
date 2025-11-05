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
    'Bot ini dibuat oleh @vallenciaaxyws\n' +
    'Silakan pilih menu di bawah ini:',
    opts
  );
});

// Menangani callback dari inline keyboard
bot.on('callback_query', (callbackQuery) => {
  const chatId = callbackQuery.message.chat.id;
  const data = callbackQuery.data;

const path = require('path'); //module ngatur path
const fs = require('fs'); //untuk akses file
const jadwal = require('./jadwal.json');

function parseTime(str) {
  const [jam, menit] = str.split('.').map(Number);
  return jam * 60 + menit;
}

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
              { text: 'Jadwal Sekarang', callback_data: 'jadwalsekarang' }
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
      const imagePath = path.join(__dirname, 'image.png');
      bot.sendPhoto(chatId, fs.createReadStream(imagePath), {
        caption: '📋 Berikut roster anda',
        parse_mode: 'Markdown'
      });
      break;

    case 'livemapel':
      const now = new Date();
      const hariList = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
      const hari = hariList[now.getDay()];

      const jamSekarang = now.getHours() * 60 + now.getMinutes();
      const jadwalHariIni = jadwal[hari];

      if (!jadwalHariIni) {
        bot.sendMessage(chatId, 'Hari ini tidak ada jadwal pelajaran.');
        break;
      }

      let currentLesson = null;

      for (const pelajaran of jadwalHariIni) {
        const [mulai, selesai] = pelajaran.waktu.split(' - ').map(s => s.split(' ')[0]);
        const start = parseTime(mulai);
        const end = parseTime(selesai);

        if (jamSekarang >= start && jamSekarang <= end) {
          currentLesson = pelajaran;
          break;
        }
      }

      if (currentLesson) {
        const [_, selesai] = currentLesson.waktu.split(' - ').map(s => s.split(' ')[0]);
        const [jamSelesai, menitSelesai] = selesai.split('.').map(Number);
        const waktuSelesai = new Date();
        waktuSelesai.setHours(jamSelesai, menitSelesai, 0, 0);

        const sisaMs = waktuSelesai - now;
        const sisaMenit = Math.floor(sisaMs / 60000);
        const sisaDetik = Math.floor((sisaMs % 60000) / 1000);

        bot.sendMessage(chatId, 
          `📘 Pelajaran yang sedang berlangsung:\n` +
          `Mapel: *${currentLesson.mapel}*\n` +
          `Guru: ${currentLesson.guru}\n` +
          `Selesai pada: ${selesai}\n\n` +
          `⏳ Waktu tersisa: ${sisaMenit} menit ${sisaDetik} detik.`,
          { parse_mode: 'Markdown' }
        );
      } else {
        bot.sendMessage(chatId, 'Sekarang tidak ada pelajaran berlangsung.');
      }
      break;

    case 'jadwalsekarang':
      bot.sendMessage(chatId, 'Jadwal pelajaran anda saat ini adalah ...');
      break;
  } // ← ini penutup switch
); // ← ini penutup event


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