const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('FATAL: JWT_SECRET environment variable is not set.');

const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const REFRESH_TOKEN_TTL_MS = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30) * 24 * 60 * 60 * 1000;
const REFRESH_COOKIE = 'getsocs_refresh';

function tokenVersion(user) { return Number.isInteger(user.tokenVersion) ? user.tokenVersion : 0; }
function signAccessToken(user) {
  return jwt.sign({ id: user.id, role: user.role, tokenVersion: tokenVersion(user) }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}
function hashRefreshToken(raw) { return crypto.createHash('sha256').update(raw).digest('hex'); }
function pruneRefreshTokens(user) {
  const now = Date.now();
  user.refreshTokens = (Array.isArray(user.refreshTokens) ? user.refreshTokens : [])
    .filter(t => t && t.hash && Date.parse(t.expiresAt) > now);
  return user.refreshTokens;
}
function issueRefreshToken(user, options = {}) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const now = Date.now();
  const familyId = options.familyId || crypto.randomUUID();
  const record = {
    id: crypto.randomUUID(),
    familyId,
    parentId: options.parentId || null,
    hash: hashRefreshToken(raw),
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + REFRESH_TOKEN_TTL_MS).toISOString(),
    usedAt: null,
    revokedAt: null,
  };
  pruneRefreshTokens(user);
  user.refreshTokens.push(record);
  return raw;
}
function findRefreshTokenRecord(user, raw) {
  if (!raw) return null;
  const hash = hashRefreshToken(raw);
  return pruneRefreshTokens(user).find(t => t.hash === hash) || null;
}
function findRefreshToken(user, raw) {
  const record = findRefreshTokenRecord(user, raw);
  return record && !record.usedAt && !record.revokedAt ? record : null;
}
function markRefreshTokenUsed(record) {
  record.usedAt = record.usedAt || new Date().toISOString();
}
function revokeRefreshToken(user, raw) {
  const record = findRefreshTokenRecord(user, raw);
  if (record && !record.revokedAt) record.revokedAt = new Date().toISOString();
}
function revokeRefreshTokenFamily(user, familyId) {
  if (!familyId) return 0;
  const now = new Date().toISOString();
  let revoked = 0;
  for (const token of pruneRefreshTokens(user)) {
    if (token.familyId === familyId && !token.revokedAt) {
      token.revokedAt = now;
      revoked += 1;
    }
  }
  return revoked;
}
function revokeAllTokens(user) {
  user.tokenVersion = tokenVersion(user) + 1;
  user.refreshTokens = [];
}
function cookieOptions() {
  const production = process.env.NODE_ENV === 'production';
  return { httpOnly: true, secure: production, sameSite: production ? 'strict' : 'lax', path: '/api/auth', maxAge: REFRESH_TOKEN_TTL_MS };
}
function setRefreshCookie(res, raw) { res.cookie(REFRESH_COOKIE, raw, cookieOptions()); }
function clearRefreshCookie(res) { res.clearCookie(REFRESH_COOKIE, { ...cookieOptions(), maxAge: undefined }); }
function parseRefreshCookie(req) {
  const cookie = req.headers.cookie || '';
  for (const part of cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === REFRESH_COOKIE) return decodeURIComponent(rest.join('='));
  }
  return null;
}
function createSession(user, res) {
  const accessToken = signAccessToken(user);
  const refreshToken = issueRefreshToken(user);
  setRefreshCookie(res, refreshToken);
  return accessToken;
}
module.exports = {
  ACCESS_TOKEN_TTL,
  signAccessToken,
  createSession,
  findRefreshToken,
  findRefreshTokenRecord,
  markRefreshTokenUsed,
  revokeRefreshToken,
  revokeRefreshTokenFamily,
  revokeAllTokens,
  parseRefreshCookie,
  setRefreshCookie,
  clearRefreshCookie,
  issueRefreshToken,
  tokenVersion,
};
