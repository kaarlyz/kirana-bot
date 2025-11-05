function parseTime(str) {
  const [jam, menit] = str.split('.').map(Number);
  return jam * 60 + (menit || 0);
}

function formatRemainingTime(selesai) {
  const [jamSelesai, menitSelesai] = selesai.split('.').map(Number);
  const waktuSelesai = new Date();
  waktuSelesai.setHours(jamSelesai, menitSelesai || 0, 0, 0);
  const sisaMs = Math.max(0, waktuSelesai - new Date());
  const sisaMenit = Math.floor(sisaMs / 60000);
  const sisaDetik = Math.floor((sisaMs % 60000) / 1000);
  return { sisaMenit, sisaDetik };
}

function getCurrentSchedule(jadwalObj, hari) {
  if (!jadwalObj || !jadwalObj[hari]) return null;
  const now = new Date();
  const jamSekarang = now.getHours() * 60 + now.getMinutes();
  const jadwalHariIni = jadwalObj[hari];
  return jadwalHariIni.find(pelajaran => {
    const [mulai, selesai] = pelajaran.waktu.split(' - ').map(s => s.split(' ')[0]);
    return jamSekarang >= parseTime(mulai) && jamSekarang <= parseTime(selesai);
  }) || null;
}

module.exports = { parseTime, formatRemainingTime, getCurrentSchedule };
