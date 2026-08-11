const jwt = require('jsonwebtoken');
const { readDB, writeDB } = require('../config/db');
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-please';
const PRESENCE_WRITE_THROTTLE_MS = 15000;

function auth(req, res, next) {
  const h = req.headers.authorization;
  if (!h) return res.status(401).json({ success: false, error: 'No token' });
  const token = h.split(' ')[1];
  try {
    const data = jwt.verify(token, JWT_SECRET);
    // Check passwordChangedAt to invalidate older tokens
    const db = readDB();
    const user = db.users.find(u => u.id === data.id);
    if (user && user.passwordChangedAt) {
      const tokenIatMs = (data.iat || 0) * 1000;
      if (tokenIatMs < new Date(user.passwordChangedAt).getTime()) {
        return res.status(401).json({ success: false, error: 'Token expired due to password change' });
      }
    }
    if (user && user.banned) {
      return res.status(401).json({ success: false, error: 'Account banned', banned: true });
    }
    if (user) {
      const lastActiveMs = user.lastActiveAt ? new Date(user.lastActiveAt).getTime() : 0;
      if (Date.now() - lastActiveMs > PRESENCE_WRITE_THROTTLE_MS) {
        user.lastActiveAt = new Date().toISOString();
        writeDB(db);
      }
    }
    req.user = data; next();
  } catch (e) { return res.status(401).json({ success: false, error: 'Invalid token' }); }
}

function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return next();
  try {
    const data = jwt.verify(token, JWT_SECRET);
    const db = readDB();
    const user = db.users.find(u => u.id === data.id);
    if (user && !user.banned) {
      req.user = data;
    }
  } catch (e) {
    // Invalid/expired token on a public route - just treat as anonymous
  }
  next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'No user' });
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    if (!roles.includes(user.role)) return res.status(403).json({ success: false, error: 'Forbidden' });
    next();
  };
}

module.exports = { auth, optionalAuth, requireRole };
