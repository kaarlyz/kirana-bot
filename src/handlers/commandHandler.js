const { logUserAction } = require('../utils/logger');
const { addTask, getTasks, updateTaskProgress, updateTaskStatus, getTaskStats, getUpcomingDeadlines } = require('../services/taskService');
const { handleError, ERROR_TYPES } = require('../utils/errorHandler');
const { listUpcoming, sendRemindersNow, scheduleReminderForTask, cancelScheduledReminder, listScheduledForUser } = require('../services/reminderService');
const config = require('../config/config');

module.exports = (bot) => {
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    const userName = msg.from.first_name || msg.from.username;
    logUserAction(userName, 'Started bot');
    const opts = { reply_markup: { inline_keyboard: [[{ text: '📋 MENU UTAMA', callback_data: 'menu' }]] } };
    bot.sendMessage(chatId, `🌟 Halo *${userName}*! Selamat datang di bot Kirana\n\nSilakan pilih menu di bawah ini:`, { ...opts, parse_mode: 'Markdown' });
  });

  bot.onText(/\/addtask (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    try {
      const parts = match[1].split('|').map(p => p.trim());
      if (parts.length !== 3) throw new Error('Format tidak valid');
      const [mapel, deskripsi, deadline] = parts;
      const task = await addTask({ mapel, deskripsi, deadline, createdBy: msg.from.id });
      await bot.sendMessage(chatId, `✅ Tugas ditambahkan: *${task.mapel}* (ID: ${task.id})`, { parse_mode: 'Markdown' });
      logUserAction(msg.from.username || msg.from.first_name, 'Added task', task.mapel);
    } catch (err) {
      await handleError(bot, chatId, err, ERROR_TYPES.TASK, msg.from.id);
    }
  });

  bot.onText(/\/tasks$/, async (msg) => {
    const chatId = msg.chat.id;
    const tasks = await getTasks();
    if (!tasks.length) return bot.sendMessage(chatId, '❌ Belum ada tugas.');
    let text = '📝 *Daftar Tugas*\n\n';
    tasks.forEach(t => {
      const daysLeft = Math.ceil((new Date(t.deadline) - new Date()) / (1000 * 60 * 60 * 24));
      text += `${t.status === 'completed' ? '✅' : '⏳'} *${t.mapel}* — ${t.deskripsi}\nID: ${t.id} | Deadline: ${t.deadline} | Progress: ${t.progress}%\n${daysLeft <= 0 ? '⚠️ Terlambat' : `ℹ️ ${daysLeft} hari lagi`}\n\n`;
    });
    await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
  });

  bot.onText(/\/progress (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const taskId = parseInt(match[1]);
    const progress = parseInt(match[2]);
    try {
      if (progress < 0 || progress > 100) throw new Error('Progress harus 0-100');
      const updated = await updateTaskProgress(taskId, progress);
      if (!updated) throw new Error('Tugas tidak ditemukan');
      await bot.sendMessage(chatId, `✅ Progress tugas *${updated.mapel}* diupdate: ${updated.progress}%`, { parse_mode: 'Markdown' });
    } catch (err) {
      await handleError(bot, chatId, err, ERROR_TYPES.TASK, msg.from.id);
    }
  });

  bot.onText(/\/done (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const taskId = parseInt(match[1]);
    try {
      const updated = await updateTaskStatus(taskId, 'completed');
      if (!updated) throw new Error('Tugas tidak ditemukan');
      await bot.sendMessage(chatId, `✅ Tugas *${updated.mapel}* telah ditandai selesai`, { parse_mode: 'Markdown' });
    } catch (err) {
      await handleError(bot, chatId, err, ERROR_TYPES.TASK, msg.from.id);
    }
  });

  // Show upcoming reminders (what bot will notify)
  bot.onText(/\/reminders$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const upcoming = await listUpcoming();
      if (!upcoming || upcoming.length === 0) {
        return bot.sendMessage(chatId, '✅ Tidak ada reminder tugas dalam 24 jam ke depan.');
      }
      let text = '⏰ *Upcoming Reminders (<=24 jam)*\n\n';
      upcoming.forEach(t => {
        const dl = new Date(t.deadline);
        text += `*${t.mapel}* — ${t.deskripsi}\nDeadline: ${dl.toLocaleString('id-ID')}\nID: ${t.id}\n\n`;
      });
      await bot.sendMessage(chatId, text, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('reminders command error', err);
      await bot.sendMessage(chatId, '❌ Gagal mengambil daftar reminder.');
    }
  });

  // Test reminder: send reminders now for this user (useful to verify)
  bot.onText(/\/testreminder$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    try {
      const sent = await sendRemindersNow(bot, userId);
      if (!sent.length) {
        return bot.sendMessage(chatId, 'ℹ️ Tidak ada reminder yang perlu dikirimkan saat ini untuk Anda.');
      }
      await bot.sendMessage(chatId, `✅ Mengirim ${sent.length} reminder sekarang. Cek chat Anda.`);
    } catch (err) {
      console.error('testreminder error', err);
      await bot.sendMessage(chatId, '❌ Gagal mengirim reminder percobaan.');
    }
  });

  // Show reminder service status (quick)
  bot.onText(/\/remindstatus$/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      const upcoming = await listUpcoming();
      await bot.sendMessage(chatId, `ℹ️ Status reminder: ${upcoming.length} tugas akan diingatkan dalam 24 jam ke depan. Gunakan /testreminder untuk uji kirim ke akun Anda.`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('remindstatus error', err);
      await bot.sendMessage(chatId, '❌ Gagal memeriksa status reminder.');
    }
  });

  // schedule custom reminder: /remindtask <taskId> <minutes>
  bot.onText(/\/remindtask (\d+) (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    try {
      const taskId = parseInt(match[1], 10);
      const minutes = parseInt(match[2], 10);
      if (isNaN(minutes) || minutes < 0) throw new Error('Minutes harus angka >= 0');

      const result = await scheduleReminderForTask(bot, userId, taskId, minutes);
      if (!result) {
        return bot.sendMessage(chatId, '❌ Tugas tidak ditemukan. Pastikan ID tugas benar (lihat /tasks).');
      }

      const phrases = [
        `⏱️ Oke! Aku akan mengingatkan dalam ${minutes} menit.`,
        `🔔 Selesai — reminder dijadwalkan untuk ${minutes} menit lagi.`,
        `✅ Reminder aktif: ${minutes} menit dari sekarang.`
      ];
      const phrase = phrases[Math.floor(Math.random() * phrases.length)];
      await bot.sendMessage(chatId, `${phrase}\n(ID tugas: ${result.taskId})`);
    } catch (err) {
      await handleError(bot, chatId, err, ERROR_TYPES.TASK, userId);
    }
  });

  // cancel scheduled custom reminder: /cancelremind <taskId>
  bot.onText(/\/cancelremind (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    try {
      const taskId = parseInt(match[1], 10);
      const ok = cancelScheduledReminder(userId, taskId);
      if (ok) {
        await bot.sendMessage(chatId, '🛑 Reminder custom dibatalkan.');
      } else {
        await bot.sendMessage(chatId, 'ℹ️ Tidak ada reminder custom yang aktif untuk tugas ini.');
      }
    } catch (err) {
      await handleError(bot, chatId, err, ERROR_TYPES.TASK, userId);
    }
  });

  bot.onText(/\/myschedules$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    try {
      const list = listScheduledForUser(userId);
      if (!list.length) return bot.sendMessage(chatId, 'ℹ️ Anda tidak memiliki scheduled reminders custom.');
      let txt = '⏲️ *Scheduled Reminders Anda:*\n\n';
      list.forEach(s => txt += `• Task ID: ${s.taskId}\n`);
      await bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('myschedules error', err);
      await bot.sendMessage(chatId, '❌ Gagal mengambil scheduled reminders.');
    }
  });

  // admin-only quick access to settings (menu button also covers)
  bot.onText(/\/settings$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    if (userId !== config.adminId) return bot.sendMessage(chatId, '⚠️ Hanya admin yang dapat membuka pengaturan.');
    await bot.sendMessage(chatId, '⚙️ Menu pengaturan (admin):', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔁 Restart (dev)', callback_data: 'admin_restart' }],
          [{ text: '🔙 Kembali', callback_data: 'menu' }]
        ]
      }
    });
  });
};
