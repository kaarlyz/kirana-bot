const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m'
};

function getTimeEmoji() {
  const hour = new Date().getHours();
  if (hour < 6) return '🌙'; // Night
  if (hour < 12) return '🌅'; // Morning
  if (hour < 18) return '☀️'; // Afternoon
  return '🌆'; // Evening
}

function logUserAction(username, action, details = '') {
  const timestamp = new Date().toLocaleString('id-ID');
  console.log(`☀️ [${timestamp}] 👤 ${username}: ${action} ${details}`);
}

module.exports = { logUserAction };
