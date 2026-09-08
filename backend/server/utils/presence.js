const ONLINE_WINDOW_MS = 60 * 1000;

function isUserOnline(user) {
  if (!user) return false;
  if (user.role === 'escrow' || user.role === 'admin') return true;
  if (!user.lastActiveAt) return false;
  return Date.now() - new Date(user.lastActiveAt).getTime() < ONLINE_WINDOW_MS;
}

module.exports = { isUserOnline, ONLINE_WINDOW_MS };
