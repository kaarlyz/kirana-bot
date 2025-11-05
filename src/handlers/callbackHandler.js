const jadwal = require('../../jadwal.json');
const { logUserAction } = require('../utils/logger');
const { getCurrentSchedule, formatRemainingTime } = require('../utils/timeUtils');
const { getRosterByDay, formatRosterMessage, getDayList } = require('../services/rosterService');
const { createUploadSession } = require('../services/uploadService');
const { getTasks, getTaskStats, updateTaskStatus, updateTaskProgress, deleteTask, getTaskById } = require('../services/taskService');
const { formatTaskMessage } = require('../utils/formatter');
const { handleError, ERROR_TYPES } = require('../utils/errorHandler');
const { startReminderService, sendRemindersNow, scheduleReminderForTask, cancelScheduledReminder, listScheduledForUser } = require('../services/reminderService');
const config = require('../config/config');

module.exports = (bot) => {
  bot.on('callback_query', async (callbackQuery) => {
    const chatId = callbackQuery.message.chat.id;
    const userName = callbackQuery.from.first_name || callbackQuery.from.username;
    const userId = callbackQuery.from.id;
    const data = callbackQuery.data;

    // Acknowledge callback to avoid Telegram re-sending on restart
    try {
      await bot.answerCallbackQuery(callbackQuery.id).catch(()=>{ /* ignore */ });
    } catch(err) {
      console.warn('answerCallbackQuery failed', err && err.message);
    }

    logUserAction(userName, 'Selected option:', data);

    try {
      switch (true) {
        case data === 'menu': {
          const menuOpts = {
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '📚 List Roster', callback_data: 'roster' },
                  { text: '📖 Mata Pelajaran', callback_data: 'livemapel' }
                ],
                [
                  { text: '📝 List Tugas', callback_data: 'tugas' },
                  { text: '📤 Upload Tugas', callback_data: 'upload' }
                ],
                [
                  { text: '🔔 Test Reminder', callback_data: 'test_reminder' },
                  { text: '🛈 Cara Set Remind', callback_data: 'remind_help' }
                ]
              ]
            }
          };
          
          await bot.sendMessage(
            chatId,
            '📋 *Menu Utama*\n\nSilakan pilih menu yang tersedia:',
            { ...menuOpts, parse_mode: 'Markdown' }
          );
          break;
        }

        case data === 'roster': {
          const rosterOpts = {
            reply_markup: {
              inline_keyboard: getDayList().reduce((acc, day, i) => {
                const btn = { text: `📅 ${day}`, callback_data: `roster_${day.toLowerCase()}` };
                if (i % 2 === 0) acc.push([btn]);
                else acc[acc.length - 1].push(btn);
                return acc;
              }, []).concat([[{ text: '🔙 Kembali', callback_data: 'menu' }]])
            }
          };
          await bot.sendMessage(chatId, '📚 *Roster Pelajaran*\n\nSilakan pilih hari:', { ...rosterOpts, parse_mode: 'Markdown' });
          break;
        }

        case /^roster_[a-z]+$/.test(data): {
          const selectedDay = data.split('_')[1].toUpperCase();
          const daySchedule = getRosterByDay(selectedDay);
          const messageText = formatRosterMessage(selectedDay, daySchedule);
          await bot.sendMessage(chatId, messageText, { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [[{ text: '🔙 Kembali ke Roster', callback_data: 'roster' }]] } });
          break;
        }

        case data === 'livemapel': {
          const hariList = ['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
          const hari = hariList[new Date().getDay()];
          const currentLesson = getCurrentSchedule(jadwal, hari);
          if (!currentLesson) {
            await bot.sendMessage(chatId, '❌ Tidak ada pelajaran yang sedang berlangsung.');
            break;
          }
          const [_, selesai] = currentLesson.waktu.split(' - ').map(s => s.split(' ')[0]);
          const { sisaMenit, sisaDetik } = formatRemainingTime(selesai);
          await bot.sendMessage(chatId, `📘 *Pelajaran yang sedang berlangsung:*\n\n📚 Mapel: *${currentLesson.mapel}*\n👨‍🏫 Guru: ${currentLesson.guru}\n⌛ Selesai pada: ${selesai}\n\n⏳ Waktu tersisa: ${sisaMenit} menit ${sisaDetik} detik.`, { parse_mode: 'Markdown' });
          break;
        }

        case data === 'tugas': {
          const stats = await getTaskStats();
          const taskMenu = { reply_markup: { inline_keyboard: [
            [{ text: '📅 Semua', callback_data: 'view_all_tasks' }, { text: '⏰ Hari Ini', callback_data: 'view_today_tasks' }],
            [{ text: '✅ Selesai', callback_data: 'view_completed' }, { text: '⚠️ Terlambat', callback_data: 'view_overdue' }],
            [{ text: '⬆️ Sort Deadline', callback_data: 'sort_deadline' }, { text: '⬆️ Sort Mapel', callback_data: 'sort_mapel' }],
            [{ text: '🔙 Kembali', callback_data: 'menu' }]
          ] } };
          const summary = `📊 *RINGKASAN TUGAS*\n\n📝 Total: ${stats.total}\n⏳ Pending: ${stats.pending}\n✅ Selesai: ${stats.completed}\n⚠️ Hari Ini: ${stats.dueToday}`;
          await bot.sendMessage(chatId, summary, { parse_mode: 'Markdown', ...taskMenu });
          break;
        }

        case /^(view_all_tasks|view_today_tasks|view_completed|view_overdue)$/.test(data): {
          const mode = data.split('_')[1];
          const map = { all: 'all', today: 'today', completed: 'completed', overdue: 'overdue' };
          const filter = map[mode] || 'all';
          const tasks = await getTasks(filter);
          await displayFilteredTasks(bot, chatId, tasks);
          break;
        }

        case /^(sort_deadline|sort_mapel)$/.test(data): {
          const sortType = data.split('_')[1];
          const tasks = await getTasks();
          if (sortType === 'deadline') tasks.sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
          else tasks.sort((a, b) => (a.mapel || '').localeCompare(b.mapel || ''));
          await displayFilteredTasks(bot, chatId, tasks);
          break;
        }

        case /^complete_\d+$/.test(data): {
          const id = parseInt(data.split('_')[1], 10);
          const task = await getTaskById(id);
          if (!task) {
            await bot.sendMessage(chatId, '❌ Tugas tidak ditemukan.');
            break;
          }
          if (task.status === 'completed') {
            await bot.sendMessage(chatId, `ℹ️ Tugas *${task.mapel}* sudah ditandai selesai.`, { parse_mode: 'Markdown' });
            break;
          }
          const updated = await updateTaskStatus(id, 'completed');
          const phrases = ['✅ Berhasil! Tugas selesai.', '🎉 Tugas sudah ditandai selesai.', '👍 Selesai!'];
          const phrase = phrases[Math.floor(Math.random() * phrases.length)];
          await bot.sendMessage(chatId, `${phrase} *${updated.mapel}*`, { parse_mode: 'Markdown' });
          break;
        }

        case /^delete_\d+$/.test(data): {
          const id = parseInt(data.split('_')[1], 10);
          // confirmation step handled elsewhere; if direct delete reached, perform and respond
          const ok = await deleteTask(id);
          await bot.sendMessage(chatId, ok ? '🗑️ Tugas berhasil dihapus' : '❌ Gagal menghapus tugas');
          break;
        }

        case /^file_\d+$/.test(data): {
          const id = parseInt(data.split('_')[1]);
          const task = await getTaskById(id);
          if (task?.file?.id) {
            await bot.sendDocument(chatId, task.file.id, { caption: `📎 File tugas: ${task.mapel}` });
          } else {
            await bot.sendMessage(chatId, '❌ File tidak ditemukan untuk tugas ini.');
          }
          break;
        }

        case data === 'upload': {
          createUploadSession(userId);
          await bot.sendMessage(chatId, '📤 *Upload Tugas* — Sesi dimulai. Kirim file (PDF/DOC/DOCX/JPG/PNG).', { parse_mode: 'Markdown' });
          break;
        }

        case /^progress_\d+$/.test(data): {
          const id = parseInt(data.split('_')[1]);
          await bot.sendMessage(chatId, `📊 Untuk mengupdate progress, kirim perintah:\n/progress ${id} <nilai>\nContoh: /progress ${id} 75`);
          break;
        }

        case data === 'test_reminder': {
          // send reminders now to this user (test)
          const userId = callbackQuery.from.id;
          const sent = await sendRemindersNow(bot, userId);
          if (!sent || sent.length === 0) {
            await bot.sendMessage(chatId, 'ℹ️ Tidak ada reminder yang perlu dikirimkan saat ini untuk Anda.');
          } else {
            await bot.sendMessage(chatId, `✅ Mengirim ${sent.length} reminder sekarang. Periksa obrolan Anda.`);
          }
          break;
        }

        case data === 'remind_help': {
          await bot.sendMessage(chatId,
            '🛈 *Cara cepat set reminder:*\n\n' +
            '1. Lihat ID tugas dengan /tasks\n' +
            '2. Set reminder custom: /remindtask <ID> <menit>\n' +
            '   Contoh: /remindtask 1762332203951 2  (ingatkan 2 menit dari sekarang)\n' +
            '3. Batalkan: /cancelremind <ID>\n\n' +
            'Gunakan juga /testreminder untuk mengirim reminder sekarang ke akun Anda.',
            { parse_mode: 'Markdown' }
          );
          break;
        }

        case /^schedule_\d+_\d+$/.test(data): {
          // format: schedule_<taskId>_<minutes>
          const m = data.match(/^schedule_(\d+)_(\d+)$/);
          const taskId = parseInt(m[1], 10);
          const minutes = parseInt(m[2], 10);
          const result = await scheduleReminderForTask(bot, callbackQuery.from.id, taskId, minutes);
          if (!result) {
            await bot.sendMessage(chatId, '❌ Tugas tidak ditemukan atau gagal menjadwalkan.');
          } else {
            await bot.sendMessage(chatId, `⏱️ Reminder dijadwalkan dalam ${minutes} menit untuk tugas ID ${taskId}.`);
          }
          break;
        }

        // Reminder callbacks
        case /^rem_complete_\d+$/.test(data): {
          const id = parseInt(data.split('_')[2], 10);
          const task = await getTaskById(id);
          if (!task) return await bot.sendMessage(chatId, '❌ Tugas tidak ditemukan.');
          if (task.status === 'completed') return await bot.sendMessage(chatId, 'ℹ️ Tugas sudah selesai.');
          const updated = await updateTaskStatus(id, 'completed');
          await bot.sendMessage(chatId, `🎉 Tugas *${updated.mapel}* ditandai selesai.`, { parse_mode: 'Markdown' });
          return;
        }

        case /^rem_progress_\d+_\d+$/.test(data): {
          const [, , tid, pct] = data.match(/^rem_progress_(\d+)_(\d+)$/) ? [null, null, ...data.match(/^rem_progress_(\d+)_(\d+)$/).slice(1)] : [];
          const taskId = parseInt(tid, 10);
          const inc = parseInt(pct, 10);
          const task = await getTaskById(taskId);
          if (!task) return await bot.sendMessage(chatId, '❌ Tugas tidak ditemukan.');
          const newProgress = Math.min(100, task.progress + inc);
          const updated = await updateTaskProgress(taskId, newProgress);
          await bot.sendMessage(chatId, `📊 Progress *${updated.mapel}* sekarang ${updated.progress}%`, { parse_mode: 'Markdown' });
          return;
        }

        case /^rem_snooze_\d+_\d+$/.test(data): {
          const m = data.match(/^rem_snooze_(\d+)_(\d+)$/);
          const taskId = parseInt(m[1], 10);
          const minutes = parseInt(m[2], 10);
          const result = await scheduleReminderForTask(bot, userId, taskId, minutes);
          if (!result) return await bot.sendMessage(chatId, '❌ Gagal menjadwalkan snooze (tugas mungkin tidak ditemukan).');
          await bot.sendMessage(chatId, `⏲️ Snoozed ${minutes} menit. Saya akan mengingatkan lagi.`);
          return;
        }

        case data === 'show_scheduled_reminders': {
          const scheduled = listScheduledForUser(userId);
          if (!scheduled.length) return await bot.sendMessage(chatId, 'ℹ️ Tidak ada scheduled reminders custom untuk akun Anda.');
          let txt = '⏲️ *Scheduled Reminders Anda:*\n\n';
          scheduled.forEach(s => txt += `• Task ID: ${s.taskId}\n`);
          await bot.sendMessage(chatId, txt, { parse_mode: 'Markdown' });
          return;
        }

        // Test reminder via button in menu (admin and user)
        case data === 'test_reminder': {
          const sent = await sendRemindersNow(bot, userId);
          if (!sent.length) return await bot.sendMessage(chatId, 'ℹ️ Tidak ada reminder untuk dikirim sekarang.');
          return await bot.sendMessage(chatId, `✅ Mengirim ${sent.length} reminder sekarang.`);
        }

        // Admin-only settings if needed
        case data === 'bot_settings': {
          if (userId !== config.adminId) return await bot.sendMessage(chatId, '⚠️ Hanya admin yang dapat mengakses pengaturan.');
          await bot.sendMessage(chatId, '⚙️ Menu pengaturan bot (admin)', {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔁 Restart (dev)', callback_data: 'admin_restart' }],
                [{ text: '🔙 Kembali', callback_data: 'menu' }]
              ]
            }
          });
          return;
        }

        // admin restart placeholder
        case data === 'admin_restart' && userId === config.adminId: {
          await bot.sendMessage(chatId, '🔁 Restart simulated (dev).');
          return;
        }

        default:
          await bot.sendMessage(chatId, '❌ Menu tidak tersedia');
      }
    } catch (err) {
      console.error('Callback error:', err);
      await bot.sendMessage(chatId, '❌ Terjadi kesalahan saat memproses menu.');
    }
  });
};

// helper
async function displayFilteredTasks(bot, chatId, tasks) {
  if (!tasks || tasks.length === 0) {
    await bot.sendMessage(chatId, '❌ Tidak ada tugas ditemukan', {
      reply_markup: {
        inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'tugas' }]]
      }
    });
    return;
  }

  for (const task of tasks) {
    const message = formatTaskMessage(task);
    await bot.sendMessage(chatId, message, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Selesai', callback_data: `complete_${task.id}` },
            { text: '📊 Progress', callback_data: `progress_${task.id}` }
          ],
          [
            { text: '📎 File', callback_data: `file_${task.id}` },
            { text: '🗑️ Hapus', callback_data: `delete_${task.id}` }
          ],
          [
            { text: '⏲️ 2m', callback_data: `schedule_${task.id}_2` },
            { text: '⏲️ 5m', callback_data: `schedule_${task.id}_5` },
            { text: '⏲️ 10m', callback_data: `schedule_${task.id}_10` }
          ]
        ]
      }
    });
  }

  await bot.sendMessage(chatId, '👆 Gunakan tombol di atas untuk mengelola tugas:', {
    reply_markup: {
      inline_keyboard: [[{ text: '🔙 Kembali', callback_data: 'tugas' }]]
    }
  });
}
