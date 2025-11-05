const path = require('path');

module.exports = {
  token: '7363365217:AAEPZV_PD2BH9QVIagW2CEEm2Fi34xrxqtU',
  uploadDir: path.join(__dirname, '../../uploads'),
  tasksFile: path.join(__dirname, '../../data/tasks.json'),
  allowedFileTypes: ['pdf', 'doc', 'docx', 'jpg', 'png'],
  maxFileSize: 20 * 1024 * 1024, // 20MB
  adminUsers: ['vallenciaaxyws'],
  adminId: 6526833205
};
