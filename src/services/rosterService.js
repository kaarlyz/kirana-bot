const jadwal = require('../../jadwal.json');

function getRosterByDay(day) {
  return jadwal[day.toUpperCase()] || null;
}

function formatRosterMessage(day, schedule) {
  if (!schedule || schedule.length === 0) {
    return `❌ Tidak ada jadwal untuk hari ${day.toLowerCase()}`;
  }

  let message = `📅 *Jadwal Hari ${day.toUpperCase()}*\n\n`;
  schedule.forEach((jadwal, index) => {
    message += `${index + 1}. ⏰ *${jadwal.waktu}*\n`;
    message += `📘 Mapel: ${jadwal.mapel}\n`;
    message += `👨‍🏫 Guru: ${jadwal.guru}\n\n`;
  });
  
  return message;
}

function getDayList() {
  return ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];
}

module.exports = {
  getRosterByDay,
  formatRosterMessage,
  getDayList
};
