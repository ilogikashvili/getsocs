const { readDB, writeDB } = require('../config/db');
const { banIp } = require('../utils/ipBans');
const crypto = require('crypto');

const PHOTO_CHANGE_CODE_TTL = 30 * 60 * 1000;

function issuePhotoChangeCode(req, res) {
  try {
    const db = readDB();
    const caller = db.users.find(u => u.id === req.user.id);
    if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Only admins can issue photo-change codes.' });

    const { photoType } = req.body;
    if (!['profile', 'background'].includes(photoType)) {
      return res.status(400).json({ success: false, error: 'photoType must be profile or background.' });
    }

    const user = db.users.find(u => u.id === req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    const photoField = photoType === 'profile' ? 'profilePhoto' : 'backgroundPhoto';
    if (!user[photoField]) return res.status(400).json({ success: false, error: `This user does not have a ${photoType} photo to change.` });

    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    db.photoChangeCodes = (db.photoChangeCodes || []).filter(entry => entry.expiresAt > Date.now() && !entry.usedAt);
    db.photoChangeCodes.push({
      id: crypto.randomUUID(),
      userId: user.id,
      photoType,
      codeHash: crypto.createHash('sha256').update(code).digest('hex'),
      issuedBy: caller.id,
      issuedAt: new Date().toISOString(),
      expiresAt: Date.now() + PHOTO_CHANGE_CODE_TTL
    });
    writeDB(db);
    res.json({ success: true, code, photoType, expiresAt: new Date(Date.now() + PHOTO_CHANGE_CODE_TTL).toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function banUser(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  if (caller.role === 'escrow' && u.role !== 'user') {
    return res.status(403).json({ success: false, error: 'Escrow can only ban users' });
  }
  u.banned = true;
  u.bannedAt = new Date().toISOString();
  u.bannedBy = caller.id;
  // Force-invalidate any existing login tokens immediately
  u.passwordChangedAt = new Date().toISOString();
  // NOTE: we intentionally do NOT auto-ban this user's known IPs here.
  // Many people share an IP (home wifi, offices, university/mobile-carrier
  // NAT), so banning an IP as a side effect of banning one account can lock
  // out unrelated, innocent users - including this site's own admin/escrow
  // accounts if they happen to share a network with the person being
  // banned. If a genuine IP-level abuse pattern needs blocking, use the
  // separate, explicit "ban IP" admin action instead.
  writeDB(db);
  res.json({ success: true });
}

function unbanUser(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  u.banned = false;
  writeDB(db);
  res.json({ success: true });
}

function makeEscrow(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  if (u.role === 'admin') return res.status(400).json({ success: false, error: 'Cannot change admin role' });
  if (u.role === 'escrow') return res.status(400).json({ success: false, error: 'User is already an escrow' });
  u.role = 'escrow';
  writeDB(db);
  res.json({ success: true, user: u });
}

function removeEscrow(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  if (u.role !== 'escrow') return res.status(400).json({ success: false, error: 'User is not an escrow' });
  u.role = 'user';
  writeDB(db);
  res.json({ success: true, user: u });
}

function banEscrow(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  if (u.role !== 'escrow') return res.status(400).json({ success: false, error: 'User is not an escrow' });
  u.banned = true;
  u.bannedAt = new Date().toISOString();
  u.bannedBy = caller.id;
  u.passwordChangedAt = new Date().toISOString();
  // See note in banUser() - IP bans are no longer an automatic side effect
  // of banning an account, to avoid locking out unrelated people who share
  // that network.
  writeDB(db);
  res.json({ success: true });
}

function changeUserRole(req, res) {
  try {
    const db = readDB();
    const caller = db.users.find(u => u.id === req.user.id);
    if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });

    const { role } = req.body;
    const validRoles = ['user', 'seller', 'escrow', 'admin'];
    if (!role || !validRoles.includes(role)) {
      return res.status(400).json({ success: false, error: 'Valid role required' });
    }

    const u = db.users.find(x => x.id === req.params.id);
    if (!u) return res.status(404).json({ success: false, error: 'User not found' });
    if (u.role === 'admin' && role !== 'admin') {
      return res.status(400).json({ success: false, error: 'Cannot demote admin' });
    }

    u.role = role;
    writeDB(db);
    res.json({ success: true, user: { id: u.id, username: u.username, role: u.role } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function createAdSpace(req, res) {
  try {
    const db = readDB();
    const caller = db.users.find(u => u.id === req.user.id);
    if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });

    const { title, position, price } = req.body;
    if (!title || !position || !price) return res.status(400).json({ success: false, error: 'Title, position, and price are required' });

    db.adSpaces = db.adSpaces || [];
    const adSpace = {
      id: Date.now().toString(),
      title,
      position,
      price: Number(price),
      createdAt: new Date().toISOString(),
      createdBy: caller.id
    };
    db.adSpaces.push(adSpace);
    writeDB(db);
    res.json({ success: true, data: adSpace });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function listAdSpaces(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  res.json({ success: true, data: db.adSpaces || [] });
}

function listUsers(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  res.json({ success: true, data: db.users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    banned: !!u.banned,
    name: u.name,
    email: u.email,
    pointsBought: u.pointsBought || 0,
    pointsSold: u.pointsSold || 0
  })) });
}

function listEscrows(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  res.json({ success: true, data: db.users.filter(u => u.role === 'escrow').map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    banned: !!u.banned,
    name: u.name,
    email: u.email,
    pointsBought: u.pointsBought || 0,
    pointsSold: u.pointsSold || 0
  })) });
}

function getStats(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const productCount = db.products.length;
  const pendingCount = db.products.filter(p => p.status === 'pending').length;
  const commentCount = db.products.reduce((sum, p) => sum + ((p.comments || []).length), 0) + (Array.isArray(db.comments) ? db.comments.length : 0);
  const transactionCount = db.transactions.length;
  const completedTransactions = db.transactions.filter(t => t.status === 'completed');
  const completedCount = completedTransactions.length;
  // "Revenue" here is the platform's own earnings (service fees), not the
  // full gross transaction value, which mostly passes through to sellers.
  const totalRevenue = completedTransactions.reduce((sum, t) => sum + (Number(t.serviceFee) || 0), 0);
  const chatCount = (Array.isArray(db.chats) ? db.chats.length : 0) + (Array.isArray(db.supportChats) ? db.supportChats.length : 0);
  const pageViews = db.analytics?.pageViews || 0;
  res.json({ success: true, data: {
    totalUsers: db.users.length,
    totalProducts: productCount,
    pendingProducts: pendingCount,
    totalComments: commentCount,
    totalTransactions: transactionCount,
    completedTransactions: completedCount,
    totalRevenue,
    totalChats: chatCount,
    pageViews
    // NOTE: no `deltas` (percentage trend vs. a prior period) is included -
    // that would require storing historical stat snapshots, which this
    // backend doesn't do. The frontend correctly hides the trend indicator
    // when it's absent rather than showing a fabricated or broken number.
  } });
}

function listAdminProducts(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const products = db.products.map(product => ({
    ...product,
    comments: product.comments || [],
    sellerName: (db.users.find(u => u.id === product.sellerId) || {}).username || product.sellerId
  }));
  res.json({ success: true, data: products });
}

function listChats(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const adminId = req.query.adminId;
  const resolveUserName = (userId) => (db.users.find(u => u.id === userId) || {}).username || userId || '';

  const directChats = (db.chats || [])
    .filter((chat) => {
      if (!adminId) return true;
      if (chat.txId) {
        const tx = (db.transactions || []).find((t) => t.id === chat.txId);
        return tx?.escrowId === adminId;
      }
      return Array.isArray(chat.participants) && chat.participants.includes(adminId);
    })
    .map(chat => {
      const tx = chat.txId ? (db.transactions || []).find((t) => t.id === chat.txId) : null;
      return {
        ...chat,
        participants: chat.participants || [],
        messages: chat.messages || [],
        lastMessage: chat.messages?.length ? chat.messages[chat.messages.length - 1].text : '',
        updatedAt: chat.messages?.length ? chat.messages[chat.messages.length - 1].ts : chat.updatedAt || chat.createdAt,
        orderId: chat.txId || null,
        dealId: chat.txId || null,
        productId: tx?.productId || null,
        productTitle: tx?.productTitle || '',
        stage: tx?.stage || null,
        buyerName: tx ? resolveUserName(tx.buyerId) : '',
        sellerName: tx ? resolveUserName(tx.sellerId) : '',
        escrowName: tx ? resolveUserName(tx.escrowId) : '',
      };
    });
  const supportChats = (db.supportChats || [])
    .filter((chat) => !adminId || chat.assignedTo === adminId)
    .map(chat => ({
      ...chat,
      participants: [],
      messages: chat.messages || [],
      lastMessage: chat.messages?.length ? chat.messages[chat.messages.length - 1].text : '',
      updatedAt: chat.messages?.length ? chat.messages[chat.messages.length - 1].ts : chat.createdAt,
      userName: (db.users.find(u => u.id === chat.userId) || {}).username || chat.userId,
      orderId: chat.txId || null,
      escrowName: chat.assignedToName || '',
    }));
  res.json({ success: true, data: { directChats, supportChats } });
}

// Explicit, deliberate IP ban - separate from banning a specific account.
// Admin-only (not escrow), since this is a broader/riskier action that can
// affect people other than the intended target if the IP is shared.
function banIpAddress(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const { ip, durationHours } = req.body;
  if (!ip || typeof ip !== 'string') return res.status(400).json({ success: false, error: 'ip is required' });
  const durationMs = durationHours ? Number(durationHours) * 60 * 60 * 1000 : undefined;
  banIp(db, ip, durationMs);
  writeDB(db);
  res.json({ success: true });
}

function unbanIpAddress(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, error: 'ip is required' });
  db.bannedIps = (db.bannedIps || []).filter(entry => entry.ip !== ip);
  writeDB(db);
  res.json({ success: true });
}

function listBannedIps(req, res) {
  const db = readDB();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const now = Date.now();
  const active = (db.bannedIps || []).filter(entry => !entry.until || entry.until > now);
  res.json({ success: true, data: active });
}

module.exports = { banUser, unbanUser, makeEscrow, removeEscrow, banEscrow, changeUserRole, createAdSpace, listAdSpaces, listUsers, listEscrows, getStats, listAdminProducts, listChats, issuePhotoChangeCode, banIpAddress, unbanIpAddress, listBannedIps };

