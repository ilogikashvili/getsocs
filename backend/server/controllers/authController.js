const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Tesseract = require('tesseract.js');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { readDB, writeDB } = require('../config/db');
const { parseGeorgianID } = require('../utils/ocr');
const { sendVerificationCode } = require('../utils/email');
const { getClientIp, isIpBanned } = require('../utils/ipBans');
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-please';
const VERIFICATION_CODE_TTL = Number(process.env.VERIFICATION_CODE_TTL || 15 * 60) * 1000;
const PASSWORD_RESET_TTL = Number(process.env.PASSWORD_RESET_TTL || 60 * 60) * 1000; // 1 hour default
const TWO_FACTOR_CODE_TTL = Number(process.env.TWO_FACTOR_CODE_TTL || 10 * 60) * 1000; // 10 minutes default

async function register(req, res) {
  try {
    const { username, mobile, name, lastname, dateOfBirth, email, personalNo, password } = req.body;
    // Email is required: it is the basis for the 1-email-per-account rule and
    // for the mandatory email-verification-before-registration flow below.
    if (!username || !password || !name || !lastname || !email) return res.status(400).json({ success: false, error: 'Missing required fields' });
    const normalizedEmail = String(email).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Invalid email format' });
    }
    const db = readDB();
    const clientIp = getClientIp(req);
    if (isIpBanned(db, clientIp)) {
      return res.status(403).json({ success: false, error: 'This network is temporarily banned from creating accounts. Please try again later.' });
    }
    if (db.users.find(u => u.username === username)) return res.status(400).json({ success: false, error: 'Username taken' });
    if (username.length < 4) return res.status(400).json({ success: false, error: 'Username must be at least 4 characters' });
    // 1 email = 1 account: block registration if this email is already tied to
    // any existing account, verified or not.
    if (db.users.find(u => typeof u.email === 'string' && u.email.toLowerCase() === normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'An account with this email already exists' });
    }

    // If an ID image is uploaded we still attempt to OCR it, but do not fail registration if it doesn't match.
    if (req.file) {
      const imagePath = req.file.path;
      try {
        const { data: { text, confidence } } = await Tesseract.recognize(imagePath, 'eng+kat');
        const scanned = parseGeorgianID(text);
        scanned.confidence = confidence;
        scanned.scannedAt = new Date().toISOString();
        scanned.id = Date.now().toString();
        scanned.imageFile = path.basename(req.file.path);
        db.scanned_ids.push(scanned);
      } catch (e) {
        // don't block registration on OCR failures
      }
    }

    const hashed = await bcrypt.hash(password, 10);
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
    writeDB(db);

    let verificationSent = false;
    try {
      await sendVerificationCode(normalizedEmail, newUser.verificationCode);
      verificationSent = true;
    } catch (emailError) {
      console.error('Verification email failed to send:', emailError.message || emailError);
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
  } finally {
    try { if (req.file) require('fs').unlinkSync(req.file.path); } catch (e) {}
  }
}

async function login(req, res) {
  try {
    const { username, password } = req.body;
    const db = readDB();
    // NOTE: deliberately not checking isIpBanned here. An IP ban exists to
    // slow down a banned person re-registering a new account (see
    // register()) - it should never block someone from logging into an
    // account that already exists and isn't itself banned, since that
    // account may belong to a completely different, innocent person who
    // just happens to share a network (home wifi, office, mobile carrier
    // NAT, etc.) with whoever triggered the IP ban.
    const clientIp = getClientIp(req);

    const loginIdentifier = String(username || '').trim().toLowerCase();
    const user = db.users.find((u) => {
      const usernameMatch = typeof u.username === 'string' && u.username.toLowerCase() === loginIdentifier;
      const emailMatch = typeof u.email === 'string' && u.email.toLowerCase() === loginIdentifier;
      return usernameMatch || emailMatch;
    });

    if (!user) return res.status(400).json({ success: false, error: 'Invalid credentials' });
    if (user.banned) return res.status(403).json({ success: false, error: 'User banned' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ success: false, error: 'Invalid credentials' });
    if (!user.verified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in.',
        requiresEmailVerification: true,
        email: user.email
      });
    }
    if (clientIp) {
      if (!Array.isArray(user.knownIps)) user.knownIps = [];
      if (!user.knownIps.includes(clientIp)) user.knownIps.push(clientIp);
      writeDB(db);
    }

    // Two-step verification: send a 6-digit code to the user's email instead
    // of logging them in immediately.
    const code = generateVerificationCode();
    user.twoFactorCode = code;
    user.twoFactorExpiresAt = Date.now() + TWO_FACTOR_CODE_TTL;
    writeDB(db);
    try {
      await sendVerificationCode(user.email, code);
    } catch (emailError) {
      return res.status(500).json({ success: false, error: 'Failed to send verification code. Please try again.' });
    }

    res.json({ success: true, requires2FA: true, userId: user.id, message: 'A 6-digit verification code has been sent to your email.' });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function verifyTwoFactor(req, res) {
  try {
    const { userId, code } = req.body;
    if (!userId || !code) return res.status(400).json({ success: false, error: 'userId and code are required' });
    const db = readDB();
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
    writeDB(db);
    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ success: true, token, user: buildPublicUser(user) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
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
    buyerVerified: !!user.buyerVerified,
    hideProfile: !!user.hideProfile,
    profilePhoto: user.profilePhoto || null,
    backgroundPhoto: user.backgroundPhoto || null
  };
}

function me(req, res) {
  try {
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.banned) return res.status(403).json({ success: false, error: 'User banned' });
    res.json({ success: true, user: buildPublicUser(user) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function verifyUser(req, res) {
  try {
    const { documentType, documentId } = req.body;
    if (!documentType || !documentId) return res.status(400).json({ success: false, error: 'Document type and ID required' });
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    user.verified = true;
    user.verifiedAt = new Date().toISOString();
    user.verificationDocument = { documentType, documentId };
    writeDB(db);
    res.json({ success: true, message: 'User verification submitted', verified: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function verifyBuyer(req, res) {
  try {
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    user.buyerVerified = true;
    user.buyerVerifiedAt = new Date().toISOString();
    writeDB(db);
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

    const db = readDB();
    const user = db.users.find(u => u.email === email || u.username === email);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.verified) return res.status(400).json({ success: false, error: 'Email already verified' });

    user.verificationCode = generateVerificationCode();
    user.verificationExpiresAt = Date.now() + VERIFICATION_CODE_TTL;
    writeDB(db);

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

    const db = readDB();
    const user = db.users.find(u => u.email === email || u.username === email);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.verified) return res.status(400).json({ success: false, error: 'Email already verified' });
    if (!user.verificationCode || user.verificationCode !== code) return res.status(400).json({ success: false, error: 'Invalid verification code' });
    if (!user.verificationExpiresAt || Date.now() > user.verificationExpiresAt) return res.status(400).json({ success: false, error: 'Verification code expired' });

    user.verified = true;
    user.verificationCode = undefined;
    user.verificationExpiresAt = undefined;
    writeDB(db);

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    res.json({
      success: true,
      message: 'Email successfully verified',
      token,
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
    const db = readDB();
    const user = db.users.find(u => u.email === email || u.username === email);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const token = crypto.randomInt(100000, 999999).toString();
    user.resetPasswordToken = token;
    user.resetPasswordExpiresAt = Date.now() + PASSWORD_RESET_TTL;
    writeDB(db);
    try {
      await sendVerificationCode(user.email, `Your verification code is ${token}`);
    } catch (e) { console.error('Failed to send reset email', e); }
    res.json({ success: true, message: 'Password reset token sent if email exists' });
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
    const db = readDB();
    const user = db.users.find(u => u.resetPasswordToken === token);
    if (!user) return res.status(400).json({ success: false, error: 'Invalid token' });
    if (!user.resetPasswordExpiresAt || Date.now() > user.resetPasswordExpiresAt) return res.status(400).json({ success: false, error: 'Token expired' });
    const hashed = await bcrypt.hash(password, 10);
    user.password = hashed;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpiresAt = undefined;
    user.passwordChangedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, message: 'Password changed' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

// Authenticated password change: requires knowing the current password
async function changePassword(req, res) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) return res.status(400).json({ success: false, error: 'Old and new password are required' });
    if (newPassword.length < 6) return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const ok = await bcrypt.compare(oldPassword, user.password);
    if (!ok) return res.status(400).json({ success: false, error: 'Current password is incorrect' });
    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordChangedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

function getVerificationStatus(req, res) {
  try {
    const db = readDB();
    const userId = req.params.userId || req.user.id;
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    res.json({ success: true, data: {
      verified: !!user.verified,
      buyerVerified: !!user.buyerVerified,
      hideProfile: !!user.hideProfile,
      role: user.role,
      verificationDocument: user.verificationDocument || null
    } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function updatePrivacy(req, res) {
  try {
    const { hide } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    user.hideProfile = hide === true || hide === 'true' || hide === 1 || hide === '1';
    writeDB(db);
    res.json({ success: true, hideProfile: user.hideProfile });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function updateProfile(req, res) {
  try {
    const { description, fullName } = req.body;
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (typeof description !== 'undefined') user.description = description;
    if (typeof fullName !== 'undefined') user.fullName = fullName;
    writeDB(db);
    res.json({ success: true, user: { id: user.id, username: user.username, fullName: user.fullName || `${user.name || ''} ${user.lastname || ''}`, description: user.description || '' } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

const VIRTUAL_REVIEW_TARGETS = { platform: 'platform', escrow: 'escrow-service' };

function postReview(req, res) {
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

    const db = readDB();
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
    // Duplicate check is per-transaction (not just per-target), so the same
    // two people can review each other again after a separate completed deal.
    const existing = db.reviews.find(r =>
      r.targetId === targetId &&
      r.authorId === req.user.id &&
      r.type === reviewType &&
      (isVirtualTarget ? true : r.transactionId === transactionId)
    );
    if (existing) {
      existing.rating = numericRating;
      existing.text = text || '';
      existing.ts = new Date().toISOString();
      writeDB(db);
      return res.json({ success: true, review: existing, updated: true });
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
    writeDB(db);
    res.json({ success: true, review });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

function getReviews(req, res) {
  try {
    const userId = req.params.userId;
    const db = readDB();
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
function getDashboardReviews(req, res) {
  try {
    const db = readDB();
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

function getProfilePublic(req, res) {
  try {
    const db = readDB();
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

function uploadProfilePhotos(req, res) {
  try {
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const files = req.files || {};
    const cleanupUploadedFiles = () => Object.values(files).flat().forEach(file => {
      try { fs.unlinkSync(file.path); } catch (e) {}
    });
    // Allow users to replace their own profile/background photos without
    // requiring an admin-issued one-time code. Profile change locking was
    // previously enforced (requiring admin-issued codes); that behavior is
    // removed so owners can update their own images freely.
    if (files.profilePhoto && files.profilePhoto.length > 0) {
      user.profilePhoto = files.profilePhoto[0].filename;
      user.profilePhotoChangeUnlockedUntil = undefined;
    }
    if (files.backgroundPhoto && files.backgroundPhoto.length > 0) {
      user.backgroundPhoto = files.backgroundPhoto[0].filename;
      user.backgroundPhotoChangeUnlockedUntil = undefined;
    }

    writeDB(db);

    const safeUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      lastname: user.lastname,
      email: user.email,
      role: user.role,
      profilePhoto: user.profilePhoto || null,
      backgroundPhoto: user.backgroundPhoto || null
    };

    res.json({ success: true, user: safeUser });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function unlockProfilePhotoChange(req, res) {
  try {
    const { code, photoType } = req.body;
    if (!code || !['profile', 'background'].includes(photoType)) {
      return res.status(400).json({ success: false, error: 'A code and valid photo type are required.' });
    }
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const codeHash = crypto.createHash('sha256').update(String(code).trim().toUpperCase()).digest('hex');
    const entry = (db.photoChangeCodes || []).find(item => item.userId === user.id && item.photoType === photoType && item.codeHash === codeHash && !item.usedAt);
    if (!entry) return res.status(400).json({ success: false, error: 'This code is invalid or has already been used.' });
    if (Date.now() > entry.expiresAt) return res.status(400).json({ success: false, error: 'This code has expired. Ask an admin for a new one.' });

    const photoField = photoType === 'profile' ? 'profilePhoto' : 'backgroundPhoto';
    const unlockField = photoType === 'profile' ? 'profilePhotoChangeUnlockedUntil' : 'backgroundPhotoChangeUnlockedUntil';
    user[photoField] = null;
    user[unlockField] = Date.now() + 10 * 60 * 1000;
    entry.usedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, message: `${photoType === 'profile' ? 'Profile' : 'Background'} photo removed. Upload one replacement within 10 minutes.`, user: { id: user.id, username: user.username, name: user.name, lastname: user.lastname, email: user.email, role: user.role, profilePhoto: user.profilePhoto, backgroundPhoto: user.backgroundPhoto } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = { register, login, verifyTwoFactor, me, verifyUser, verifyBuyer, getVerificationStatus, updatePrivacy, getProfilePublic, uploadProfilePhotos, unlockProfilePhotoChange, resendVerificationCode, verifyEmail, requestPasswordReset, resetPassword, changePassword, updateProfile, postReview, getReviews, getDashboardReviews };


