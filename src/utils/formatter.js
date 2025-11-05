function formatTaskMessage(task) {
  const deadline = new Date(task.deadline);
  const now = new Date();
  const daysLeft = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  
  const priorityEmoji = {
    high: '🔴',
    normal: '🟡',
    low: '🟢'
  };

  return `${priorityEmoji[task.priority]} *${task.mapel}*\n\n` +
         `📝 ${task.deskripsi}\n` +
         `⏰ Deadline: ${deadline.toLocaleDateString('id-ID')}\n` +
         `📊 Progress: ${task.progress}%\n` +
         `📎 File: ${task.file ? '✅' : '❌'}\n` +
         `${daysLeft <= 0 ? '⚠️' : 'ℹ️'} ${Math.abs(daysLeft)} hari ${daysLeft <= 0 ? 'terlambat' : 'lagi'}\n` +
         `🏷️ Status: ${task.status === 'completed' ? '✅ Selesai' : '⏳ Pending'}`;
}

module.exports = { formatTaskMessage };
