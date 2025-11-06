// src/shared/tiktokSessions.js
const tiktokSessions = new Map(); // key = userId -> { promptMessageId, createdAt }
const TIKTOK_SESSION_TTL = 1000 * 60 * 5; // 5 menit

module.exports = { tiktokSessions, TIKTOK_SESSION_TTL };
