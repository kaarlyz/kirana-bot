const { getUpcomingDeadlines, getTaskById } = require('./taskService');
const { logUserAction } = require('../utils/logger');

// store scheduled one-off timers per user: `${userId}:${taskId}` -> timeoutId
const customTimers = new Map();
const sentReminders = new Set();

function getPriorityEmoji(priority) {
	return priority === 'high' ? '🔴' : priority === 'low' ? '🟢' : '🟡';
}

function formatReminderMessage(task) {
	const deadline = new Date(task.deadline);
	const hoursLeft = Math.max(0, Math.round((deadline - new Date()) / (1000 * 60 * 60)));
	return `⏰ *PENGINGAT TUGAS*\n\n` +
		`${getPriorityEmoji(task.priority)} *${task.mapel}*\n` +
		`📝 ${task.deskripsi}\n` +
		`⏰ Deadline: ${deadline.toLocaleString('id-ID')}\n` +
		`⌛ Waktu tersisa: ${hoursLeft} jam\n\n` +
		`Tindakan cepat: tekan tombol di bawah untuk menandai selesai atau update progress.`;
}

function startReminderService(bot) {
	setInterval(async () => {
		try {
			const upcoming = await getUpcomingDeadlines();
			for (const task of upcoming) {
				if (!task.createdBy) continue;
				if (sentReminders.has(task.id)) continue;
				await bot.sendMessage(task.createdBy, formatReminderMessage(task), { parse_mode: 'Markdown' });
				sentReminders.add(task.id);
				logUserAction('System', 'Sent reminder', `${task.mapel} -> ${task.createdBy}`);
			}
		} catch (err) {
			console.error('Reminder service error', err);
		}
	}, 30 * 60 * 1000); // every 30 minutes
}

// NEW: return upcoming tasks (no sending)
async function listUpcoming() {
	const upcoming = await getUpcomingDeadlines();
	return upcoming;
}

// NEW: send reminders now; optional targetUserId to send only to that user (for testing)
async function sendRemindersNow(bot, targetUserId = null) {
	const upcoming = await getUpcomingDeadlines();
	const sent = [];
	for (const task of upcoming) {
		if (targetUserId && task.createdBy !== targetUserId) continue;
		if (sentReminders.has(task.id)) continue;
		if (!task.createdBy) continue;

		// send with inline keyboard for quick actions
		await bot.sendMessage(task.createdBy, formatReminderMessage(task), {
			parse_mode: 'Markdown',
			reply_markup: {
				inline_keyboard: [
					[
						{ text: '✅ Done', callback_data: `rem_complete_${task.id}` },
						{ text: '📊 +25%', callback_data: `rem_progress_${task.id}_25` },
						{ text: '📊 +50%', callback_data: `rem_progress_${task.id}_50` }
					],
					[
						{ text: '⏲️ Snooze 10m', callback_data: `rem_snooze_${task.id}_10` },
						{ text: '⏲️ Snooze 30m', callback_data: `rem_snooze_${task.id}_30` },
						{ text: '🔍 Show Scheduled', callback_data: 'show_scheduled_reminders' }
					]
				]
			}
		});
		sentReminders.add(task.id);
		sent.push(task.id);
		logUserAction('System', 'Sent reminder', `${task.mapel} -> ${task.createdBy}`);
	}
	return sent;
}

// NEW: allow clearing in-memory sent set (for dev/testing)
function resetSentReminders() {
	sentReminders.clear();
}

// NEW: send reminder for a specific task
async function sendReminderForTask(bot, task, targetUserId = null) {
	if (!task) return false;
	const recipient = targetUserId || task.createdBy;
	if (!recipient) return false;
	await bot.sendMessage(recipient, formatReminderMessage(task), { parse_mode: 'Markdown' });
	logUserAction('System', 'Sent reminder', `${task.mapel} -> ${recipient}`);
	sentReminders.add(task.id);
	return true;
}

// schedule one-off reminder for task after `minutes` (used by /remindtask and buttons)
async function scheduleReminderForTask(bot, userId, taskId, minutes) {
	const task = await getTaskById(taskId);
	if (!task) return null;
	const key = `${userId}:${taskId}`;
	if (customTimers.has(key)) {
		clearTimeout(customTimers.get(key));
		customTimers.delete(key);
	}
	const delay = Math.max(0, Math.floor(minutes)) * 60 * 1000;
	const timeoutId = setTimeout(async () => {
		try {
			await bot.sendMessage(userId, formatReminderMessage(task), {
				parse_mode: 'Markdown',
				reply_markup: {
					inline_keyboard: [
						[
							{ text: '✅ Done', callback_data: `rem_complete_${task.id}` },
							{ text: '📊 +25%', callback_data: `rem_progress_${task.id}_25` }
						]
					]
				}
			});
			logUserAction('System', 'Sent custom reminder', `${task.mapel} -> ${userId}`);
		} catch (err) {
			console.error('Custom reminder send error', err);
		} finally {
			customTimers.delete(key);
		}
	}, delay);

	customTimers.set(key, timeoutId);
	return { taskId: task.id, scheduledInMinutes: minutes };
}

// NEW: cancel a scheduled custom reminder
function cancelScheduledReminder(userId, taskId) {
	const key = `${userId}:${taskId}`;
	const t = customTimers.get(key);
	if (t) {
		clearTimeout(t);
		customTimers.delete(key);
		return true;
	}
	return false;
}

// NEW: list scheduled custom reminders for a user (transparent view)
function listScheduledForUser(userId) {
	const list = [];
	for (const [key] of customTimers) {
		const [uid, tid] = key.split(':').map(v => parseInt(v, 10));
		if (uid === userId) {
			list.push({ taskId: tid });
		}
	}
	return list;
}

// NEW: expose internal sets (for status)
function listSentReminders() {
	return Array.from(sentReminders);
}

// EXPORTS
module.exports = {
	startReminderService,
	listUpcoming,
	sendRemindersNow,
	resetSentReminders,
	scheduleReminderForTask,
	cancelScheduledReminder,
	listScheduledForUser,
	listSentReminders
};
