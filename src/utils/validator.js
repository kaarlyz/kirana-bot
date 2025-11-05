function validateTaskInfo(mapel, deskripsi, deadline) {
  if (!mapel || !deskripsi || !deadline) {
    throw new Error('Semua field harus diisi');
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(deadline)) {
    throw new Error('Format tanggal harus YYYY-MM-DD');
  }

  const deadlineDate = new Date(deadline);
  if (isNaN(deadlineDate.getTime())) {
    throw new Error('Tanggal tidak valid');
  }

  if (deadlineDate < new Date()) {
    throw new Error('Deadline tidak boleh di masa lalu');
  }

  return true;
}

module.exports = { validateTaskInfo };
