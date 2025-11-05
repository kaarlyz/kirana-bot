const { logUserAction } = require('../utils/logger');
const { createUploadSession, getUploadSession, updateUploadSession, clearUploadSession } = require('../services/uploadService');
const { addTask } = require('../services/taskService');
const { handleError, ERROR_TYPES } = require('../utils/errorHandler');

module.exports = (bot) => {
	// Handle incoming documents (file upload) — only accept when session active
	bot.on('document', async (msg) => {
		const chatId = msg.chat.id;
		const userId = msg.from.id;
		const session = getUploadSession(userId);
		const file = msg.document;

		try {
			// session must be active
			if (!session || session.status !== 'waiting_file') {
				await bot.sendMessage(chatId, '❌ Sesi upload tidak ditemukan. Silakan mulai dari menu *Upload Tugas*.', { parse_mode: 'Markdown' });
				return;
			}

			// validate mime and size
			const allowed = [
				'application/pdf',
				'application/msword',
				'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'image/jpeg',
				'image/png'
			];
			if (!allowed.includes(file.mime_type)) {
				return await handleError(bot, chatId, new Error('Invalid file type'), ERROR_TYPES.FILE_TYPE, userId);
			}
			if (file.file_size && file.file_size > 20 * 1024 * 1024) {
				return await handleError(bot, chatId, new Error('File too large'), ERROR_TYPES.FILE_SIZE, userId);
			}

			// store file info in session and ask for task details
			updateUploadSession(userId, {
				status: 'waiting_info',
				fileInfo: {
					id: file.file_id,
					name: file.file_name,
					size: file.file_size,
					mime: file.mime_type
				}
			});

			const prompt = await bot.sendMessage(
				chatId,
				'📝 *File diterima!*\nSilakan balas (reply) pesan ini dengan format:\nMapel | Deskripsi | Deadline (YYYY-MM-DD)\n\n_Contoh:_ Matematika | PR Bab 3 | 2024-02-20',
				{ parse_mode: 'Markdown', reply_markup: { force_reply: true, selective: true } }
			);

			updateUploadSession(userId, { promptMessageId: prompt.message_id });
		} catch (err) {
			console.error('document handler error', err);
			await handleError(bot, chatId, err, ERROR_TYPES.UPLOAD, userId);
		}
	});

	// Handle replies to the prompt (task info)
	bot.on('message', async (msg) => {
		// ignore commands and documents here
		if (!msg.text || msg.text.startsWith('/')) return;

		const chatId = msg.chat.id;
		const userId = msg.from.id;
		const session = getUploadSession(userId);
		if (!session || session.status !== 'waiting_info') return;

		// ensure it's a reply to our prompt if promptMessageId exists
		if (session.promptMessageId && msg.reply_to_message?.message_id !== session.promptMessageId) return;

		try {
			// accept flexible date formats like 2025-11-5 or 2025-11-05
			const parts = msg.text.split('|').map(p => p.trim()).filter(Boolean);
			if (parts.length !== 3) {
				throw new Error('Format harus: Mapel | Deskripsi | YYYY-MM-DD');
			}
			const [mapel, deskripsi, rawDeadline] = parts;

			// normalize date
			const dateMatch = rawDeadline.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
			if (!dateMatch) throw new Error('Format tanggal harus YYYY-MM-DD (contoh: 2024-02-20)');
			const year = parseInt(dateMatch[1], 10);
			const month = parseInt(dateMatch[2], 10);
			const day = parseInt(dateMatch[3], 10);
			const d = new Date(year, month - 1, day);
			if (isNaN(d.getTime()) || d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) {
				throw new Error('Tanggal tidak valid');
			}

			// disallow past dates
			const today = new Date();
			today.setHours(0,0,0,0);
			d.setHours(0,0,0,0);
			if (d < today) throw new Error('Deadline tidak boleh di masa lalu');

			const normalizedDeadline = d.toISOString().split('T')[0];

			const task = await addTask({
				mapel,
				deskripsi,
				deadline: normalizedDeadline,
				file: session.fileInfo,
				createdBy: userId
			});

			// Variasi pesan sukses
			const successPhrases = [
				'✅ Tugas berhasil ditambahkan!',
				'🎉 Berhasil! Tugas sudah tersimpan.',
				'👍 Selesai! Tugas ditambahkan ke daftar.'
			];
			const phrase = successPhrases[Math.floor(Math.random() * successPhrases.length)];

			await bot.sendMessage(chatId,
				`${phrase}\n\n📚 *${mapel}*\n📝 ${deskripsi}\n⏰ ${normalizedDeadline}\n📎 ${session.fileInfo?.name || 'Tidak ada'}`,
				{
					parse_mode: 'Markdown',
					reply_markup: {
						inline_keyboard: [[
							{ text: '✅ Tandai Selesai', callback_data: `complete_${task.id}` },
							{ text: '📋 Lihat Semua Tugas', callback_data: 'view_all_tasks' }
						]]
					}
				}
			);

			clearUploadSession(userId);
			logUserAction(msg.from.username || msg.from.first_name, 'Uploaded task', mapel);
		} catch (err) {
			// user-friendly varied error messages
			const hints = [
				'Coba lagi dengan format: MataPelajaran | Deskripsi | 2024-02-20',
				'Periksa format tanggal dan pastikan tidak lewat dari hari ini',
				'Contoh benar: Matematika | PR Bab 3 | 2024-02-20'
			];
			const hint = hints[Math.floor(Math.random() * hints.length)];
			await bot.sendMessage(chatId, `❌ Error: ${err.message}\n\n${hint}`, { parse_mode: 'Markdown', reply_to_message_id: msg.message_id });
			// keep session so user can correct input
		}
	});
};
