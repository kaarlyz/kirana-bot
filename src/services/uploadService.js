const uploadSessions = new Map();
const SESSION_TTL = 1000 * 60 * 15; // 15 minutes

function createUploadSession(userId) {
  const session = {
    status: 'waiting_file',
    createdAt: Date.now(),
    fileInfo: null,
    promptMessageId: null
  };
  uploadSessions.set(userId, session);
  return session;
}

function getUploadSession(userId) {
  const s = uploadSessions.get(userId) || null;
  if (!s) return null;
  if (Date.now() - s.createdAt > SESSION_TTL) {
    uploadSessions.delete(userId);
    return null;
  }
  return s;
}

function updateUploadSession(userId, data) {
  const session = uploadSessions.get(userId);
  if (!session) return null;
  const updated = { ...session, ...data };
  uploadSessions.set(userId, updated);
  return updated;
}

function clearUploadSession(userId) {
  uploadSessions.delete(userId);
}

module.exports = {
  createUploadSession,
  getUploadSession,
  updateUploadSession,
  clearUploadSession
};
