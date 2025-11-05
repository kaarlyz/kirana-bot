const ERROR_TYPES = {
  UPLOAD: 'upload',
  TASK: 'task',
  NETWORK: 'network',
  PERMISSION: 'permission',
  VALIDATION: 'validation',
  FILE_SIZE: 'file_size',
  FILE_TYPE: 'file_type',
  SESSION_EXPIRED: 'session_expired',
  TASK_NOT_FOUND: 'task_not_found',
  INVALID_DATE: 'invalid_date',
  RATE_LIMIT: 'rate_limit'
};

function logError(error, type, userId = null) {
  const timestamp = new Date().toLocaleString('id-ID');
  const userInfo = userId ? `[USER: ${userId}]` : '';
  console.error(`[${timestamp}] ${userInfo} [${type.toUpperCase()}] ${error.message}`);
  if (error.stack) {
    console.error(error.stack);
  }
}

function getUserMessage(error, type) {
  switch (type) {
    case ERROR_TYPES.UPLOAD:
      return '❌ Gagal mengupload file. Pastikan format dan ukuran file sesuai.';
    case ERROR_TYPES.TASK:
      return '❌ Gagal memproses tugas. Silakan cek format input Anda.';
    case ERROR_TYPES.NETWORK:
      return '❌ Koneksi terputus. Silakan coba lagi.';
    case ERROR_TYPES.PERMISSION:
      return '❌ Anda tidak memiliki akses untuk melakukan ini.';
    case ERROR_TYPES.VALIDATION:
      return `❌ Input tidak valid: ${error.message}`;
    case ERROR_TYPES.FILE_SIZE:
      return '❌ Ukuran file terlalu besar (maksimal 20MB)';
    case ERROR_TYPES.FILE_TYPE:
      return '❌ Format file tidak didukung. Gunakan PDF/DOC/DOCX';
    case ERROR_TYPES.SESSION_EXPIRED:
      return '❌ Sesi telah berakhir. Silakan mulai ulang dengan /start';
    case ERROR_TYPES.TASK_NOT_FOUND:
      return '❌ Tugas tidak ditemukan';
    case ERROR_TYPES.INVALID_DATE:
      return '❌ Format tanggal tidak valid. Gunakan YYYY-MM-DD';
    case ERROR_TYPES.RATE_LIMIT:
      return '❌ Terlalu banyak permintaan. Tunggu beberapa saat';
    default:
      return '❌ Terjadi kesalahan. Silakan coba lagi nanti.';
  }
}

async function handleError(bot, chatId, error, type = 'general', userId = null) {
  logError(error, type, userId);
  
  const buttons = [];
  
  // Add contextual buttons based on error type
  switch (type) {
    case ERROR_TYPES.UPLOAD:
      buttons.push({ text: '📤 Upload Ulang', callback_data: 'upload' });
      break;
    case ERROR_TYPES.SESSION_EXPIRED:
      buttons.push({ text: '🔄 Mulai Ulang', callback_data: 'start' });
      break;
    case ERROR_TYPES.TASK_NOT_FOUND:
      buttons.push({ text: '📝 Lihat Tugas', callback_data: 'tugas' });
      break;
    default:
      buttons.push({ text: '🔄 Coba Lagi', callback_data: 'menu' });
  }
  
  try {
    await bot.sendMessage(
      chatId,
      getUserMessage(error, type),
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [buttons]
        }
      }
    );
  } catch (sendError) {
    console.error('Failed to send error message:', sendError);
  }
}

module.exports = { 
  handleError,
  ERROR_TYPES,
  logError,
  getUserMessage 
};
