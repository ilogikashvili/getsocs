const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { loadAuthState, saveAuthState, withAuthState } = require('../repositories/authRepository');
const { sendVerificationCode } = require('../utils/email');
const { getClientIp, isIpBanned } = require('../utils/ipBans');
const storageService = require('../services/storageService');
const { invalidateProductCaches } = require('../services/productCacheService');
const { validateRegistrationInput, validateEmail, validatePassword, validateUsername, sanitizeString } = require('../utils/inputValidation');
const { createSession, findRefreshToken, findRefreshTokenRecord, markRefreshTokenUsed, revokeRefreshToken, revokeRefreshTokenFamily, revokeAllTokens, parseRefreshCookie, setRefreshCookie, clearRefreshCookie, issueRefreshToken, signAccessToken } = require('../services/tokenService');
const logger = require('../utils/logger');
const VERIFICATION_CODE_TTL = Number(process.env.VERIFICATION_CODE_TTL || 15 * 60) * 1000;
const PASSWORD_RESET_TTL = Number(process.env.PASSWORD_RESET_TTL || 60 * 60) * 1000; // 1 hour default
const TWO_FACTOR_CODE_TTL = Number(process.env.TWO_FACTOR_CODE_TTL || 10 * 60) * 1000; // 10 minutes default

async function register(req, res) {
  try {
    // Registration accepts multipart text fields only. Identity documents
    // are deliberately handled later by /verify-user, which stores them in
    // private storage for authenticated review.

    // Input validation: Sanitize and validate all user inputs
    const validationResult = validateRegistrationInput(req.body);
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        errors: validationResult.errors
      });
    }
    
    const { username, mobile, name, lastname, dateOfBirth, email, personalNo, password } = validationResult.data;
    const normalizedEmail = email.toLowerCase();
    const clientIp = getClientIp(req);
    const hashed = await bcrypt.hash(password, 10);

    // Everything that actually reads-then-writes the shared user list has to
    // happen inside one locked, synchronous block. Otherwise two signups
    // racing on the same username/email could both pass the "not taken"
    // check against their own stale snapshot and both get written, with the
    // second await saveAuthState() silently discarding whatever the first one saved.
    const outcome = await withAuthState(async (db) => {
      if (isIpBanned(db, clientIp)) {
        return { status: 403, error: 'This network is temporarily banned from creating accounts. Please try again later.' };
      }
      if (db.users.find(u => u.username === username)) {
        return { status: 400, error: 'Username taken' };
      }
      if (db.users.find(u => typeof u.email === 'string' && u.email.toLowerCase() === normalizedEmail)) {
        return { status: 400, error: 'An account with this email already exists' };
      }
      const emailBlocks = getEmailDeleteBlocks(db);
      if (emailBlocks.some(entry => entry.email.toLowerCase() === normalizedEmail)) {
        return { status: 400, error: 'This email was deleted and cannot be used to create an account for 30 days.' };
      }

      const newUser = {
        id: Date.now().toString(),
        username,
        mobile,
        name,
        lastname,
        dateOfBirth,
        email: normalizedEmail,
        personalNo,
        password: hashed,
        role: 'user',
        banned: false,
        verified: false,
        buyerVerified: false,
        hideProfile: false,
        knownIps: clientIp ? [clientIp] : []
      };
      newUser.verificationCode = generateVerificationCode();
      newUser.verificationExpiresAt = Date.now() + VERIFICATION_CODE_TTL;
      db.users.push(newUser);

      return { status: 200, verificationCode: newUser.verificationCode };
    });

    if (outcome.status !== 200) {
      return res.status(outcome.status).json({ success: false, error: outcome.error });
    }

    let verificationSent = false;
    try {
      await sendVerificationCode(normalizedEmail, outcome.verificationCode);
      verificationSent = true;
    } catch (emailError) {
      logger.warn('Verification email delivery failed', { errorName: emailError?.name, errorCode: emailError?.code });
    }

    // No login token is issued here. The account exists but is unusable
    // (verified: false) until the code is confirmed via /verify-email/code,
    // which is what actually completes registration and returns the token.
    res.json({
      success: true,
      requiresEmailVerification: true,
      email: normalizedEmail,
      verificationSent,
      message: 'Enter the verification code sent to your email to finish creating your account.'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function login(req, res) {
  try {
    // Input validation: Sanitize and validate credentials
    const { username, password } = req.body;
    
    // Validate that credentials are provided
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }
    if (!password || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({ success: false, error: 'Invalid credentials' });
    }
    
    // Sanitize input - normalize but preserve case for username
    const loginIdentifier = String(username).trim().toLowerCase();
    const clientIp = getClientIp(req);

    // The DB read-modify-write happens inside withAuthState so a concurrent
    // request can't sneak in during the bcrypt.compare() await and have its
    // changes silently wiped out when this request writes back its own
    // (by then stale) snapshot of the whole database. The email send stays
    // OUTSIDE the lock deliberately - it's a slow, unbounded network call,
    // and holding a global lock across it would stall every other login/
    // registration on the site for as long as SMTP takes to respond.
    const outcome = await withAuthState(async (db) => {
      const user = db.users.find((u) => {
        const usernameMatch = typeof u.username === 'string' && u.username.toLowerCase() === loginIdentifier;
        const emailMatch = typeof u.email === 'string' && u.email.toLowerCase() === loginIdentifier;
        return usernameMatch || emailMatch;
      });

      if (!user) return { status: 400, error: 'Invalid credentials' };
      if (user.banned) return { status: 403, error: 'User banned' };

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return { status: 400, error: 'Invalid credentials' };

      if (!user.verified) {
        return { status: 403, error: 'Please verify your email before logging in.', requiresEmailVerification: true, email: user.email };
      }

      if (clientIp) {
        if (!Array.isArray(user.knownIps)) user.knownIps = [];
        if (!user.knownIps.includes(clientIp)) user.knownIps.push(clientIp);
      }

      const code = generateVerificationCode();
      user.twoFactorCode = code;
      user.twoFactorExpiresAt = Date.now() + TWO_FACTOR_CODE_TTL;

      return { status: 200, userId: user.id, email: user.email, code };
    });

    if (outcome.status !== 200) {
      return res.status(outcome.status).json({
        success: false,
        error: outcome.error,
        ...(outcome.requiresEmailVerification ? { requiresEmailVerification: true, email: outcome.email } : {})
      });
    }

    let verificationSent = true;
    try {
      await sendVerificationCode(outcome.email, outcome.code);
    } catch (emailError) {
      verificationSent = false;
      logger.warn('2FA email delivery failed', { errorName: emailError?.name, errorCode: emailError?.code });
    }

    res.json({
      success: true,
      requires2FA: true,
      userId: outcome.userId,
      verificationSent,
      canResend: !verificationSent,
      message: verificationSent
        ? 'A 6-digit verification code has been sent to your email.'
        : 'Your password is correct, but the verification email could not be sent right now. Please retry sending the code.'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

// If the initial code email failed to send (SMTP hiccup etc.), let the user
// retry without re-entering their password. The code/expiry was already
// saved on the user record in login(), so this just re-sends it.
async function resendTwoFactorCode(req, res) {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ success: false, error: 'userId is required' });
    const db = await loadAuthState();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.banned) return res.status(403).json({ success: false, error: 'User banned' });

    const code = generateVerificationCode();
    user.twoFactorCode = code;
    user.twoFactorExpiresAt = Date.now() + TWO_FACTOR_CODE_TTL;
    await saveAuthState(db);
    try {
      await sendVerificationCode(user.email, code);
    } catch (emailError) {
      logger.warn('2FA email resend failed', { errorName: emailError?.name, errorCode: emailError?.code });
      return res.status(503).json({ success: false, error: 'Could not send the code right now. Please try again in a moment.' });
    }
    res.json({ success: true, message: 'A new verification code has been sent to your email.' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function verifyTwoFactor(req, res) {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ success: false, error: 'userId and code are required' });
    const db = await loadAuthState();
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.banned) return res.status(403).json({ success: false, error: 'User banned' });
    if (!user.twoFactorCode || user.twoFactorCode !== code) {
      return res.status(400).json({ success: false, error: 'Invalid verification code' });
    }
    if (!user.twoFactorExpiresAt || Date.now() > user.twoFactorExpiresAt) {
      return res.status(400).json({ success: false, error: 'Verification code expired. Please log in again.' });
    }
    user.twoFactorCode = undefined;
    user.twoFactorExpiresAt = undefined;
    await saveAuthState(db);
    const token = createSession(user, res);
    await saveAuthState(db);
    res.json({ success: true, token, accessToken: token, user: buildPublicUser(user) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}


async function refreshSession(req, res) {
  try {
    const raw = parseRefreshCookie(req);
    if (!raw) return res.status(401).json({ success: false, error: 'Refresh token required' });
    const db = await loadAuthState();
    let user = null;
    let record = null;
    for (const candidate of (db.users || [])) {
      const match = findRefreshTokenRecord(candidate, raw);
      if (match) { user = candidate; record = match; break; }
    }
    if (!user || !record || user.banned || record.revokedAt) {
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, error: 'Invalid refresh token' });
    }
    // A used refresh token being presented again is strong evidence of theft.
    // Revoke every descendant/sibling in that login family so the legitimate
    // rotated token cannot continue after a replay attack.
    if (record.usedAt) {
      revokeRefreshTokenFamily(user, record.familyId);
      await saveAuthState(db);
      clearRefreshCookie(res);
      return res.status(401).json({ success: false, error: 'Refresh token replay detected; session revoked' });
    }
    // Backward compatibility: tokens created before family tracking gain a
    // family the first time they rotate.
    record.familyId = record.familyId || crypto.randomUUID();
    markRefreshTokenUsed(record);
    const nextRefresh = issueRefreshToken(user, { familyId: record.familyId, parentId: record.id });
    const token = signAccessToken(user);
    await saveAuthState(db);
    setRefreshCookie(res, nextRefresh);
    return res.json({ success: true, token, accessToken: token, user: buildPublicUser(user) });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Could not refresh session' });
  }
}

async function logout(req, res) {
  try {
    const raw = parseRefreshCookie(req);
    if (raw) {
      const db = await loadAuthState();
      const user = (db.users || []).find(u => findRefreshToken(u, raw));
      if (user) {
        revokeRefreshToken(user, raw);
        await saveAuthState(db);
      }
    }
    clearRefreshCookie(res);
    return res.json({ success: true });
  } catch (e) {
    clearRefreshCookie(res);
    return res.json({ success: true });
  }
}

async function logoutEverywhere(req, res) {
  try {
    const db = await loadAuthState();
    const user = (db.users || []).find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    revokeAllTokens(user);
    await saveAuthState(db);
    clearRefreshCookie(res);
    return res.json({ success: true, message: 'All sessions have been revoked.' });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Could not revoke sessions' });
  }
}

function buildPublicUser(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    name: user.name,
    lastname: user.lastname,
    email: user.email,
    mobile: user.mobile,
    pointsBought: user.pointsBought || 0,
    pointsSold: user.pointsSold || 0,
    verified: !!user.verified,
    idVerified: !!user.idVerified,
    idVerificationStatus: user.idVerificationStatus || null,
    buyerVerified: !!user.buyerVerified,
    hideProfile: !!user.hideProfile,
    profilePhoto: user.profilePhoto || null,
    backgroundPhoto: user.backgroundPhoto || null,
    nameChangedAt: user.nameChangedAt || null,
    lastnameChangedAt: user.lastnameChangedAt || null,
    usernameChangedAt: user.usernameChangedAt || null
  };
}

function getEmailDeleteBlocks(db) {
  db.emailDeleteBlocks = Array.isArray(db.emailDeleteBlocks) ? db.emailDeleteBlocks : [];
  db.emailDeleteBlocks = db.emailDeleteBlocks.filter(entry => !entry.until || entry.until > Date.now());
  return db.emailDeleteBlocks;
}

function canChangeProfileName(user) {
  if (!user) return false;
  const updatedAt = user.nameChangedAt || user.lastnameChangedAt;
  if (!updatedAt) return true;
  const lastChange = new Date(updatedAt).getTime();
  return Number.isFinite(lastChange) ? Date.now() - lastChange >= 30 * 24 * 60 * 60 * 1000 : true;
}

function canChangeUsername(user) {
  if (!user) return false;
  if (!user.usernameChangedAt) return true;
  const lastChange = new Date(user.usernameChangedAt).getTime();
  return Number.isFinite(lastChange) ? Date.now() - lastChange >= 30 * 24 * 60 * 60 * 1000 : true;
}

async function me(req, res) {
  try {
    const db = await loadAuthState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.banned) return res.status(403).json({ success: false, error: 'User banned' });
    res.json({ success: true, user: buildPublicUser(user) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function verifyUser(req, res) {
  let storedKey = null;
  try {
    const { documentType, documentId } = req.body;
    if (!documentType || !documentId) return res.status(400).json({ success: false, error: 'Document type and ID required' });
    if (!req.file) return res.status(400).json({ success: false, error: 'An ID document image is required for verification.' });
    const db = await loadAuthState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.idVerified) return res.status(400).json({ success: false, error: 'Your identity is already verified.' });
    if (user.idVerificationStatus === 'pending') return res.status(400).json({ success: false, error: 'Your verification is already pending review.' });

    storedKey = await storageService.putFile(req.file.path, { visibility: 'private', prefix: `identity/${user.id}` });
    const previousKey = user.verificationDocument?.imageFile || null;
    user.idVerificationStatus = 'pending';
    user.idVerificationSubmittedAt = new Date().toISOString();
    user.verificationDocument = { documentType, documentId, imageFile: storedKey };
    await saveAuthState(db);
    await storageService.cleanupStaging([req.file]);
    if (previousKey && previousKey !== storedKey) storageService.deleteObject(previousKey, 'private').catch(() => {});
    res.json({ success: true, message: 'Your ID has been submitted for review. This usually takes 1-2 business days.', status: 'pending' });
  } catch (e) {
    if (storedKey) await storageService.deleteObject(storedKey, 'private').catch(() => {});
    await storageService.cleanupStaging(req.file ? [req.file] : []);
    res.status(500).json({ success: false, error: e.message });
  }
}

async function verifyBuyer(req, res) {
  try {
    const db = await loadAuthState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    user.buyerVerified = true;
    user.buyerVerifiedAt = new Date().toISOString();
    await saveAuthState(db);
    res.json({ success: true, message: 'Buyer verification completed', buyerVerified: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function generateVerificationCode() {
  return crypto.randomInt(100000, 999999).toString();
}

async function resendVerificationCode(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required' });

    const db = await loadAuthState();
    const user = db.users.find(u => u.email === email || u.username === email);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.verified) return res.status(400).json({ success: false, error: 'Email already verified' });

    user.verificationCode = generateVerificationCode();
    user.verificationExpiresAt = Date.now() + VERIFICATION_CODE_TTL;
    await saveAuthState(db);

    try {
      await sendVerificationCode(user.email, user.verificationCode);
    } catch (emailError) {
      return res.status(500).json({ success: false, error: 'Failed to send verification email' });
    }

    res.json({ success: true, message: 'Verification code sent' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ success: false, error: 'Email and code are required' });

    const db = await loadAuthState();
    const user = db.users.find(u => u.email === email || u.username === email);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.verified) return res.status(400).json({ success: false, error: 'Email already verified' });
    if (!user.verificationCode || user.verificationCode !== code) return res.status(400).json({ success: false, error: 'Invalid verification code' });
    if (!user.verificationExpiresAt || Date.now() > user.verificationExpiresAt) return res.status(400).json({ success: false, error: 'Verification code expired' });

    user.verified = true;
    user.verificationCode = undefined;
    user.verificationExpiresAt = undefined;
    await saveAuthState(db);

    const token = createSession(user, res);
    await saveAuthState(db);
    res.json({
      success: true,
      message: 'Email successfully verified',
      token,
      accessToken: token,
      user: buildPublicUser(user)
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

// Password reset: request reset token
async function requestPasswordReset(req, res) {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required' });

    // Always return the same response whether or not the account exists -
    // otherwise the response itself (200 vs 404, different message) lets
    // anyone check which emails have accounts on this site just by hitting
    // this endpoint. Only the internal side effect (token + email) is
    // conditional on the account actually existing.
    const genericResponse = { success: true, message: "If an account with that email exists, we've sent a password reset code to it." };

    const outcome = await withAuthState(async (db) => {
      const user = db.users.find(u => u.email === email || u.username === email);
      if (!user) return null;
      const token = crypto.randomInt(100000, 999999).toString();
      user.resetPasswordToken = token;
      user.resetPasswordExpiresAt = Date.now() + PASSWORD_RESET_TTL;
      return { email: user.email, token };
    });

    if (outcome) {
      try {
        await sendVerificationCode(outcome.email, `Your verification code is ${outcome.token}`);
      } catch (e) { logger.warn('Password reset email delivery failed', { errorName: e?.name, errorCode: e?.code }); }
    }

    res.json(genericResponse);
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

// Password reset: perform reset with token
async function resetPassword(req, res) {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ success: false, error: 'Token and new password required' });
    if (!/^\d{6}$/.test(String(token))) {
      return res.status(400).json({ success: false, error: 'Reset token must be a 6-digit code' });
    }

    const outcome = await withAuthState(async (db) => {
      const user = db.users.find(u => u.resetPasswordToken === token);
      if (!user) return { status: 400, error: 'Invalid token' };
      if (!user.resetPasswordExpiresAt || Date.now() > user.resetPasswordExpiresAt) return { status: 400, error: 'Token expired' };
      const hashed = await bcrypt.hash(password, 10);
      user.password = hashed;
      user.resetPasswordToken = undefined;
      user.resetPasswordExpiresAt = undefined;
      user.passwordChangedAt = new Date().toISOString();
      revokeAllTokens(user);
      return { status: 200 };
    });

    if (outcome.status !== 200) return res.status(outcome.status).json({ success: false, error: outcome.error });
    res.json({ success: true, message: 'Password changed' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

// Authenticated password change: requires knowing the current password
async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ success: false, error: 'Old and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });

    const outcome = await withAuthState(async (db) => {
      const user = db.users.find(u => u.id === req.user.id);
      if (!user) return { status: 404, error: 'User not found' };
      const ok = await bcrypt.compare(oldPassword, user.password);
      if (!ok) return { status: 400, error: 'Current password is incorrect' };
      user.password = await bcrypt.hash(newPassword, 10);
      user.passwordChangedAt = new Date().toISOString();
      revokeAllTokens(user);
      return { status: 200 };
    });

    if (outcome.status !== 200) return res.status(outcome.status).json({ success: false, error: outcome.error });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function getVerificationStatus(req, res) {
  try {
    const db = await loadAuthState();
    const userId = req.params.userId || req.user.id;
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const isSelfOrReviewer = user.id === req.user.id || req.user.role === 'admin' || req.user.role === 'escrow';
    const data = {
      verified: !!user.verified,
      idVerified: !!user.idVerified,
      buyerVerified: !!user.buyerVerified,
      hideProfile: !!user.hideProfile,
      role: user.role
    };
    // Never expose document IDs, storage keys, or verificationDocument through
    // this general status endpoint. The actual document has a separate,
    // role-protected admin/escrow route.
    if (isSelfOrReviewer) data.idVerificationStatus = user.idVerificationStatus || null;
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function updatePrivacy(req, res) {
  try {
    const { hide } = req.body;
    const db = await loadAuthState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    user.hideProfile = hide === true || hide === 'true' || hide === 1 || hide === '1';
    await saveAuthState(db);
    res.json({ success: true, hideProfile: user.hideProfile });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function updateProfile(req, res) {
  try {
    const { description, fullName, name, lastname } = req.body;
    const db = await loadAuthState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (typeof description !== 'undefined') user.description = description;
    if (typeof fullName !== 'undefined' && String(fullName).trim()) {
      const parts = String(fullName).trim().split(/\s+/);
      if (parts.length > 0) {
        const firstName = parts[0];
        const lastName = parts.slice(1).join(' ');
        if (!canChangeProfileName(user)) {
          return res.status(400).json({ success: false, error: 'You can only change your name once every 30 days.' });
        }
        if (firstName && user.name !== firstName) user.name = firstName;
        if (lastName && user.lastname !== lastName) user.lastname = lastName;
        user.nameChangedAt = new Date().toISOString();
      }
    }
    if (typeof name !== 'undefined' || typeof lastname !== 'undefined') {
      const nextName = typeof name !== 'undefined' ? String(name).trim() : user.name || '';
      const nextLastname = typeof lastname !== 'undefined' ? String(lastname).trim() : user.lastname || '';
      if (!canChangeProfileName(user) && (nextName && user.name !== nextName || nextLastname && user.lastname !== nextLastname)) {
        return res.status(400).json({ success: false, error: 'You can only change your name once every 30 days.' });
      }
      if (nextName) user.name = nextName;
      if (typeof lastname !== 'undefined') user.lastname = nextLastname;
      if (nextName || nextLastname) user.nameChangedAt = new Date().toISOString();
    }
    if (typeof fullName !== 'undefined' && !String(fullName).trim()) {
      user.fullName = '';
    }
    await saveAuthState(db);
    res.json({ success: true, user: { id: user.id, username: user.username, name: user.name, lastname: user.lastname, fullName: `${user.name || ''} ${user.lastname || ''}`.trim(), description: user.description || '', nameChangedAt: user.nameChangedAt || null, lastnameChangedAt: user.lastnameChangedAt || null } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

// Real name / last name always have to match the account holder's actual
// identity (they're what ID verification checks against), so they're not
// meant to be casually edited. The username - the public handle - is the
// thing users are expected to change from time to time, so it gets its own
// endpoint with its own uniqueness check and 30-day cooldown.
async function updateUsername(req, res) {
  try {
    const { username } = req.body || {};
    if (!username || typeof username !== 'string' || !validateUsername(username)) {
      return res.status(400).json({ success: false, error: 'Username must be 4-32 characters and can only contain letters, numbers, underscores, hyphens, and dots.' });
    }
    const nextUsername = sanitizeString(username);

    const outcome = await withAuthState(async (db) => {
      const user = db.users.find(u => u.id === req.user.id);
      if (!user) return { status: 404, error: 'User not found' };

      if (user.username === nextUsername) {
        return { status: 400, error: 'That is already your username.' };
      }
      if (!canChangeUsername(user)) {
        return { status: 400, error: 'You can only change your username once every 30 days.' };
      }
      const taken = db.users.some(u => u.id !== user.id && typeof u.username === 'string' && u.username.toLowerCase() === nextUsername.toLowerCase());
      if (taken) {
        return { status: 400, error: 'That username is already taken.' };
      }

      user.username = nextUsername;
      user.usernameChangedAt = new Date().toISOString();
      return { status: 200, user: buildPublicUser(user) };
    });

    if (outcome.status !== 200) {
      return res.status(outcome.status).json({ success: false, error: outcome.error });
    }
    res.json({ success: true, user: outcome.user });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function deleteAccount(req, res) {
  try {
    const { confirmation, confirmationText, fullName } = req.body || {};
    const outcome = await withAuthState(async db => {
      const user = db.users.find(u => u.id === req.user.id);
      if (!user) return { statusCode: 404, body: { success: false, error: 'User not found' } };
      if (!confirmation) return { statusCode: 400, body: { success: false, error: 'Please confirm that you want to delete your account.' } };

      const expectedText = `DELETE ${`${user.name || ''} ${user.lastname || ''}`.trim() || user.username}`.trim();
      if (String(confirmationText || '').trim().toUpperCase() !== expectedText.toUpperCase()) {
        return { statusCode: 400, body: { success: false, error: `Type "${expectedText}" exactly to confirm account deletion.` } };
      }
      const suppliedName = `${(user.name || '')} ${(user.lastname || '')}`.trim();
      if (fullName && String(fullName).trim() && String(fullName).trim().toLowerCase() !== suppliedName.toLowerCase()) {
        return { statusCode: 400, body: { success: false, error: 'The full name you entered does not match your account.' } };
      }

      // Account deletion must never erase a live marketplace obligation.
      const activeTransactions = (db.transactions || []).filter(tx =>
        (tx.buyerId === user.id || tx.sellerId === user.id) &&
        ['pending', 'escrow_active', 'disputed'].includes(tx.status)
      );
      if (activeTransactions.length) {
        return { statusCode: 409, body: { success: false, error: 'Your account has an active transaction or dispute. Complete or resolve it before deleting the account.' } };
      }

      const ownedProducts = (db.products || []).filter(product => product.sellerId === user.id);
      const publicKeys = [user.profilePhoto, user.backgroundPhoto];
      for (const product of ownedProducts) {
        if (Array.isArray(product.images)) publicKeys.push(...product.images);
        else if (product.image) publicKeys.push(product.image);
      }
      const privateKeys = [user.verificationDocument?.imageFile];

      const deleteUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
      db.emailDeleteBlocks = Array.isArray(db.emailDeleteBlocks) ? db.emailDeleteBlocks : [];
      db.emailDeleteBlocks.push({ email: user.email.toLowerCase(), until: deleteUntil });

      const removedUserId = user.id;
      const removedProductIds = new Set(ownedProducts.map(product => product.id));
      db.products = (db.products || []).filter(product => product.sellerId !== removedUserId);
      db.transactions = (db.transactions || []).filter(tx => tx.buyerId !== removedUserId && tx.sellerId !== removedUserId);
      const remainingTxIds = new Set((db.transactions || []).map(tx => tx.id));
      db.chats = (db.chats || []).filter(chat => (!chat.txId || remainingTxIds.has(chat.txId)) && !chat.participants?.includes(removedUserId));
      db.bids = (db.bids || []).filter(bid => bid.bidderId !== removedUserId && !removedProductIds.has(bid.listingId));
      db.notifications = (db.notifications || []).filter(notification => notification.userId !== removedUserId);
      db.userBadges = (db.userBadges || []).filter(item => item.userId !== removedUserId);
      db.userMemberships = (db.userMemberships || []).filter(item => item.userId !== removedUserId);
      db.userAddons = (db.userAddons || []).filter(item => item.userId !== removedUserId);
      db.users = (db.users || []).filter(u => u.id !== removedUserId);

      return {
        statusCode: 200,
        body: { success: true, message: 'Account deleted successfully. Your email is locked for 30 days and your listings were removed.' },
        publicKeys: [...new Set(publicKeys.filter(Boolean))],
        privateKeys: [...new Set(privateKeys.filter(Boolean))],
        removedProductIds: [...removedProductIds]
      };
    });

    if (outcome.statusCode !== 200) return res.status(outcome.statusCode).json(outcome.body);
    await Promise.allSettled([
      ...outcome.publicKeys.map(key => storageService.deleteObject(key, 'public')),
      ...outcome.privateKeys.map(key => storageService.deleteObject(key, 'private')),
      ...outcome.removedProductIds.map(id => invalidateProductCaches(id))
    ]);
    await invalidateProductCaches();
    return res.json(outcome.body);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

const VIRTUAL_REVIEW_TARGETS = { platform: 'platform', escrow: 'escrow-service' };

async function postReview(req, res) {
  try {
    const { targetId, rating, text, type, transactionId } = req.body; // type: seller|buyer|escrow|platform
    if (!targetId || !rating) return res.status(400).json({ success: false, error: 'targetId and rating required' });
    const numericRating = Number(rating);
    if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ success: false, error: 'Rating must be a number between 1 and 5' });
    }
    const reviewType = ['seller', 'buyer', 'escrow', 'platform'].includes(type) ? type : 'seller';
    const isVirtualTarget = reviewType === 'platform'
      ? targetId === VIRTUAL_REVIEW_TARGETS.platform
      : reviewType === 'escrow' && targetId === VIRTUAL_REVIEW_TARGETS.escrow;

    const db = await loadAuthState();
    let tx = null;
    if (!isVirtualTarget) {
      // Reviewing a specific person (buyer, seller, or a named escrow agent)
      // is only allowed once a real, completed transaction ties the reviewer
      // and that person together - anyone could otherwise post a review
      // about anyone with no transaction ever having happened.
      if (targetId === req.user.id) {
        return res.status(400).json({ success: false, error: 'You cannot review yourself' });
      }
      const target = db.users.find(u => u.id === targetId);
      if (!target) return res.status(404).json({ success: false, error: 'Target user not found' });

      if (!transactionId) {
        return res.status(400).json({ success: false, error: 'A completed transaction with this person is required to leave a review.' });
      }
      tx = (db.transactions || []).find(t => t.id === transactionId);
      if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });
      if (tx.status !== 'completed') {
        return res.status(400).json({ success: false, error: 'You can only leave a review after the transaction is completed.' });
      }

      const isReviewerPartyToTx = tx.buyerId === req.user.id || tx.sellerId === req.user.id;
      if (!isReviewerPartyToTx) {
        return res.status(403).json({ success: false, error: 'You were not part of this transaction.' });
      }

      let targetMatchesRole = false;
      if (reviewType === 'seller') {
        targetMatchesRole = tx.buyerId === req.user.id && tx.sellerId === targetId;
      } else if (reviewType === 'buyer') {
        targetMatchesRole = tx.sellerId === req.user.id && tx.buyerId === targetId;
      } else if (reviewType === 'escrow') {
        targetMatchesRole = tx.escrowId === targetId;
      }
      if (!targetMatchesRole) {
        return res.status(400).json({ success: false, error: 'This person was not the counterparty on that transaction.' });
      }
    }
    db.reviews = db.reviews || [];
    // Per-transaction reviews (seller/buyer/a named escrow agent) update in
    // place on resubmission - re-reviewing the exact same completed deal
    // isn't a new event, and this prevents spam-stacking duplicates for one
    // transaction. Virtual-target reviews (platform / general escrow
    // service) are NOT transaction-scoped, so each submission is treated as
    // a new, distinct review instead of silently overwriting the person's
    // one-and-only platform review - people's experience/opinion can change
    // over multiple uses of the site, and that history is worth keeping.
    if (!isVirtualTarget) {
      const existing = db.reviews.find(r =>
        r.targetId === targetId &&
        r.authorId === req.user.id &&
        r.type === reviewType &&
        r.transactionId === transactionId
      );
      if (existing) {
        existing.rating = numericRating;
        existing.text = text || '';
        existing.ts = new Date().toISOString();
        await saveAuthState(db);
        return res.json({ success: true, review: existing, updated: true });
      }
    }
    const review = {
      id: Date.now().toString(),
      targetId,
      rating: numericRating,
      text: text || '',
      type: reviewType,
      authorId: req.user.id,
      transactionId: isVirtualTarget ? null : transactionId,
      ts: new Date().toISOString()
    };
    db.reviews.push(review);
    await saveAuthState(db);
    res.json({ success: true, review });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function editReview(req, res) {
  try {
    const { rating, text } = req.body;
    const db = await loadAuthState();
    const review = (db.reviews || []).find(r => r.id === req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });
    if (review.authorId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only edit your own reviews' });
    }
    if (rating !== undefined) {
      const numericRating = Number(rating);
      if (!Number.isFinite(numericRating) || numericRating < 1 || numericRating > 5) {
        return res.status(400).json({ success: false, error: 'Rating must be a number between 1 and 5' });
      }
      review.rating = numericRating;
    }
    if (text !== undefined) review.text = text;
    review.editedAt = new Date().toISOString();
    await saveAuthState(db);
    res.json({ success: true, review });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function deleteReview(req, res) {
  try {
    const db = await loadAuthState();
    const caller = db.users.find(u => u.id === req.user.id);
    const review = (db.reviews || []).find(r => r.id === req.params.reviewId);
    if (!review) return res.status(404).json({ success: false, error: 'Review not found' });
    const isOwner = review.authorId === req.user.id;
    const isModerator = caller && (caller.role === 'admin' || caller.role === 'escrow');
    if (!isOwner && !isModerator) {
      return res.status(403).json({ success: false, error: 'Not allowed to delete this review' });
    }
    db.reviews = (db.reviews || []).filter(r => r.id !== req.params.reviewId);
    await saveAuthState(db);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getReviews(req, res) {
  try {
    const userId = req.params.userId;
    const db = await loadAuthState();
    const reviews = (db.reviews || [])
      .filter(r => r.targetId === userId)
      .map(r => {
        const author = db.users.find(u => u.id === r.authorId);
        return { ...r, authorName: author ? author.username : 'Deleted user' };
      })
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));
    const average = reviews.length ? Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10 : 0;
    res.json({ success: true, data: reviews, average, count: reviews.length });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

// Public summary used by the dashboard: recent reviews grouped into the three
// categories shown there (peer-to-peer, platform/website, escrow service).
async function getDashboardReviews(req, res) {
  try {
    const db = await loadAuthState();
    const all = (db.reviews || [])
      .map(r => {
        const author = db.users.find(u => u.id === r.authorId);
        return { ...r, authorName: author ? author.username : 'Deleted user' };
      })
      .sort((a, b) => new Date(b.ts) - new Date(a.ts));

    function bucket(types, limit = 12) {
      const items = all.filter(r => types.includes(r.type)).slice(0, limit);
      const average = items.length ? Math.round((items.reduce((sum, r) => sum + r.rating, 0) / items.length) * 10) / 10 : 0;
      return { data: items, average, count: items.length };
    }

    res.json({
      success: true,
      userToUser: bucket(['seller', 'buyer']),
      userToWebsite: bucket(['platform']),
      userToEscrow: bucket(['escrow'])
    });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function getProfilePublic(req, res) {
  try {
    const db = await loadAuthState();
    const userId = req.params.userId || req.user.id;
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.hideProfile && req.user.id !== user.id && req.user.role !== 'admin') {
      return res.json({ success: true, data: {
        id: user.id,
        username: user.username,
        hidden: true
      } });
    }
    const out = {
      id: user.id,
      username: user.username,
      role: user.role,
      verified: !!user.verified,
      idVerified: !!user.idVerified,
      idVerificationStatus: user.idVerificationStatus || null,
      buyerVerified: !!user.buyerVerified,
      hideProfile: !!user.hideProfile,
      sellerInfo: {
        pointsBought: user.pointsBought || 0,
        pointsSold: user.pointsSold || 0
      }
    };
    // Only show real name to the user themself or admins
    if (req.user.id === user.id || req.user.role === 'admin') {
      out.name = user.name;
      out.lastname = user.lastname;
    }
    res.json({ success: true, data: out });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function uploadProfilePhotos(req, res) {
  const newlyStored = [];
  const staged = Object.values(req.files || {}).flat().filter(Boolean);
  try {
    const db = await loadAuthState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const files = req.files || {};
    const oldProfilePhoto = user.profilePhoto;
    const oldBackgroundPhoto = user.backgroundPhoto;
    if (files.profilePhoto?.length) {
      const key = await storageService.putFile(files.profilePhoto[0].path, { visibility: 'public', prefix: `profiles/${user.id}` });
      newlyStored.push(key); user.profilePhoto = key;
    }
    if (files.backgroundPhoto?.length) {
      const key = await storageService.putFile(files.backgroundPhoto[0].path, { visibility: 'public', prefix: `profiles/${user.id}` });
      newlyStored.push(key); user.backgroundPhoto = key;
    }

    await saveAuthState(db);
    await storageService.cleanupStaging(staged);
    if (files.profilePhoto?.length && oldProfilePhoto && oldProfilePhoto !== user.profilePhoto) storageService.deleteObject(oldProfilePhoto, 'public').catch(() => {});
    if (files.backgroundPhoto?.length && oldBackgroundPhoto && oldBackgroundPhoto !== user.backgroundPhoto) storageService.deleteObject(oldBackgroundPhoto, 'public').catch(() => {});

    res.json({ success: true, user: {
      id: user.id, username: user.username, name: user.name, lastname: user.lastname, email: user.email, role: user.role,
      profilePhoto: user.profilePhoto || null, backgroundPhoto: user.backgroundPhoto || null
    }});
  } catch (e) {
    await Promise.allSettled(newlyStored.map(key => storageService.deleteObject(key, 'public')));
    await storageService.cleanupStaging(staged);
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { register, login, verifyTwoFactor, resendTwoFactorCode, refreshSession, logout, logoutEverywhere, me, verifyUser, verifyBuyer, getVerificationStatus, updatePrivacy, getProfilePublic, uploadProfilePhotos, resendVerificationCode, verifyEmail, requestPasswordReset, resetPassword, changePassword, updateProfile, updateUsername, deleteAccount, postReview, editReview, deleteReview, getReviews, getDashboardReviews };

