const jwt = require('jsonwebtoken');
const { loadUserById, updateUserLastActive } = require('../repositories/authRepository');
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('FATAL: JWT_SECRET environment variable is not set. Please set it in .env file.');
}
const PRESENCE_WRITE_THROTTLE_MS = 15000;

async function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ success: false, error: 'No token' });
  const token = h.split(' ')[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    const user = await loadUserById(data.id);
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    const currentTokenVersion = Number.isInteger(user.tokenVersion) ? user.tokenVersion : 0;
    if ((data.tokenVersion ?? 0) !== currentTokenVersion) {
      return res.status(401).json({ success: false, error: 'Token has been revoked' });
    }
    // Backward-compatible password timestamp invalidation remains as a second layer.
    if (user.passwordChangedAt) {
      const tokenIatMs = (data.iat || 0) * 1000;
      if (tokenIatMs < new Date(user.passwordChangedAt).getTime()) {
        return res.status(401).json({ success: false, error: 'Token expired due to password change' });
      }
    }
    if (user.banned) {
      return res.status(401).json({ success: false, error: 'Account banned', banned: true });
    }
    {
      const lastActiveMs = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
      if (Date.now() - lastActiveMs > PRESENCE_WRITE_THROTTLE_MS) {
        await updateUserLastActive(user.id, new Date().toISOString());
      }
    }
    req.user = data; next();
  } catch (e) { return res.status(401).json({ success: false, error: 'Invalid token' }); }
}

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const data = jwt.verify(token, JWT_SECRET);
    const user = await loadUserById(data.id);
    const currentTokenVersion = user && Number.isInteger(user.tokenVersion) ? user.tokenVersion : 0;
    if (user && !user.banned && (data.tokenVersion ?? 0) === currentTokenVersion) {
      req.user = data;
    }
  } catch (e) {
    // Invalid/expired token on a public route - just treat as anonymous
  }
  next();
}

function requireRole(...roles) {
  return async (req, res, next) => {
    try {
    if (!req.user) return res.status(401).json({ success: false, error: 'No user' });
    const user = await loadUserById(req.user.id);
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    if (!roles.includes(user.role)) return res.status(403).json({ success: false, error: 'Forbidden' });
    next();
    } catch (e) { next(e); }
  };
}

module.exports = { auth, optionalAuth, requireRole };
