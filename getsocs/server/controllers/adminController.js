const storageService = require('../services/storageService');
const { loadAdminState, saveAdminState } = require('../repositories/adminRepository');
const { banIp } = require('../utils/ipBans');
const crypto = require('crypto');
const { revokeAllTokens } = require('../services/tokenService');

async function banUser(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || (caller.role !== 'escrow' && caller.role !== 'admin')) return res.status(403).json({ success: false, error: 'Forbidden' });
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
  revokeAllTokens(u);
  // NOTE: we intentionally do NOT auto-ban this user's known IPs here.
  // Many people share an IP (home wifi, offices, university/mobile-carrier
  // NAT), so banning an IP as a side effect of banning one account can lock
  // out unrelated, innocent users - including this site's own admin/escrow
  // accounts if they happen to share a network with the person being
  // banned. If a genuine IP-level abuse pattern needs blocking, use the
  // separate, explicit "ban IP" admin action instead.
  await saveAdminState(db);
  res.json({ success: true });
}

async function unbanUser(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  u.banned = false;
  await saveAdminState(db);
  res.json({ success: true });
}

async function makeEscrow(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  if (u.role === 'admin') return res.status(400).json({ success: false, error: 'Cannot change admin role' });
  if (u.role === 'escrow') return res.status(400).json({ success: false, error: 'User is already an escrow' });
  u.role = 'escrow';
  await saveAdminState(db);
  res.json({ success: true, user: u });
}

async function removeEscrow(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  if (u.role !== 'escrow') return res.status(400).json({ success: false, error: 'User is not an escrow' });
  u.role = 'user';
  await saveAdminState(db);
  res.json({ success: true, user: u });
}

async function banEscrow(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const u = db.users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).json({ success: false, error: 'User not found' });
  if (u.role !== 'escrow') return res.status(400).json({ success: false, error: 'User is not an escrow' });
  u.banned = true;
  u.bannedAt = new Date().toISOString();
  u.bannedBy = caller.id;
  u.passwordChangedAt = new Date().toISOString();
  revokeAllTokens(u);
  // See note in banUser() - IP bans are no longer an automatic side effect
  // of banning an account, to avoid locking out unrelated people who share
  // that network.
  await saveAdminState(db);
  res.json({ success: true });
}

async function changeUserRole(req, res) {
  try {
    const db = await loadAdminState();
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
    await saveAdminState(db);
    res.json({ success: true, user: { id: u.id, username: u.username, role: u.role } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function createAdSpace(req, res) {
  try {
    const db = await loadAdminState();
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
    await saveAdminState(db);
    res.json({ success: true, data: adSpace });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function listAdSpaces(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  res.json({ success: true, data: db.adSpaces || [] });
}

async function listUsers(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Forbidden' });
  res.json({ success: true, data: db.users.map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    banned: !!u.banned,
    name: u.name,
    email: u.email,
    lastActiveAt: u.lastActiveAt || null,
    pointsBought: u.pointsBought || 0,
    pointsSold: u.pointsSold || 0
  })) });
}

async function listEscrows(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  res.json({ success: true, data: db.users.filter(u => u.role === 'escrow').map(u => ({
    id: u.id,
    username: u.username,
    role: u.role,
    banned: !!u.banned,
    name: u.name,
    email: u.email,
    lastActiveAt: u.lastActiveAt || null,
    pointsBought: u.pointsBought || 0,
    pointsSold: u.pointsSold || 0
  })) });
}

async function getStats(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Forbidden' });
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

async function getDailyActiveUsers(req, res) {
  try {
    const db = await loadAdminState();
    const caller = db.users.find(u => u.id === req.user.id);
    if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Forbidden' });

    const dailyCounts = new Map();
    for (const user of db.users || []) {
      const timestamp = user?.lastActiveAt;
      if (!timestamp) continue;
      const date = new Date(timestamp);
      if (Number.isNaN(date.getTime())) continue;
      const dayKey = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
      dailyCounts.set(dayKey, (dailyCounts.get(dayKey) || 0) + 1);
    }

    const data = [...dailyCounts.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, activeUsers]) => ({ day, activeUsers }));

    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

async function listAdminProducts(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Forbidden' });
  const products = db.products.map(product => ({
    ...product,
    comments: product.comments || [],
    sellerName: (db.users.find(u => u.id === product.sellerId) || {}).username || product.sellerId
  }));
  res.json({ success: true, data: products });
}

async function listChats(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Forbidden' });
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

async function getAdminComments(req, res) {
  try {
    const db = await loadAdminState();
    const caller = db.users.find(u => u.id === req.user.id);
    if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Forbidden' });

    const productMap = (db.products || []).reduce((map, product) => {
      map[product.id] = product;
      return map;
    }, {});

    const topLevel = (db.comments || []).map((comment) => {
      const author = db.users.find(u => u.id === comment.userId);
      const product = productMap[comment.productId];
      return {
        ...comment,
        authorName: author ? author.username : 'Deleted user',
        productTitle: product ? product.title || product.name : 'Unknown product',
      };
    });

    const nested = (db.products || []).flatMap((product) => {
      if (!Array.isArray(product.comments)) return [];
      return product.comments.map((comment) => {
        const author = db.users.find(u => u.id === comment.userId);
        return {
          ...comment,
          productId: product.id,
          authorName: author ? author.username : 'Deleted user',
          productTitle: product.title || product.name || 'Unknown product',
          nested: true,
        };
      });
    });

    const comments = [...topLevel, ...nested].sort((a, b) => new Date(b.ts) - new Date(a.ts));
    res.json({ success: true, data: comments });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getAdminReviews(req, res) {
  try {
    const db = await loadAdminState();
    const caller = db.users.find(u => u.id === req.user.id);
    if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Forbidden' });

    const users = (db.users || []).reduce((map, user) => {
      map[user.id] = user.username;
      return map;
    }, {});

    const reviews = (db.reviews || []).map((review) => {
      const authorName = users[review.authorId] || 'Deleted user';
      let targetName = users[review.targetId] || review.targetId;
      if (review.type === 'platform') targetName = 'Platform';
      if (review.type === 'escrow' && review.targetId === 'escrow-service') targetName = 'Escrow service';
      return {
        ...review,
        authorName,
        targetName,
      };
    }).sort((a, b) => new Date(b.ts) - new Date(a.ts));
    res.json({ success: true, data: reviews });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

// Explicit, deliberate IP ban - separate from banning a specific account.
// Admin-only (not escrow), since this is a broader/riskier action that can
// affect people other than the intended target if the IP is shared.
async function banIpAddress(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const { ip, durationHours } = req.body;
  if (!ip || typeof ip !== 'string') return res.status(400).json({ success: false, error: 'ip is required' });
  const durationMs = durationHours ? Number(durationHours) * 60 * 60 * 1000 : undefined;
  banIp(db, ip, durationMs);
  await saveAdminState(db);
  res.json({ success: true });
}

async function unbanIpAddress(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const { ip } = req.body;
  if (!ip) return res.status(400).json({ success: false, error: 'ip is required' });
  db.bannedIps = (db.bannedIps || []).filter(entry => entry.ip !== ip);
  await saveAdminState(db);
  res.json({ success: true });
}

async function listBannedIps(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || caller.role !== 'admin') return res.status(403).json({ success: false, error: 'Forbidden' });
  const now = Date.now();
  const active = (db.bannedIps || []).filter(entry => !entry.until || entry.until > now);
  res.json({ success: true, data: active });
}

// ID verification review queue - the badge is only granted once an admin
// (or escrow agent) approves the document the user submitted via /verify-user.
async function listIdVerifications(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Forbidden' });
  const pending = (db.users || [])
    .filter(u => u.idVerificationStatus === 'pending')
    .map(u => ({
      userId: u.id,
      username: u.username,
      email: u.email,
      name: u.name,
      lastname: u.lastname,
      submittedAt: u.idVerificationSubmittedAt,
      documentType: u.verificationDocument?.documentType,
      documentId: u.verificationDocument?.documentId,
      imageFile: u.verificationDocument?.imageFile
    }));
  res.json({ success: true, data: pending });
}


async function getIdVerificationImage(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Forbidden' });
  const user = db.users.find(u => u.id === req.params.userId);
  if (!user || user.idVerificationStatus !== 'pending' || !user.verificationDocument?.imageFile) {
    return res.status(404).json({ success: false, error: 'Verification document not found' });
  }
  return storageService.sendPrivateObject(res, user.verificationDocument.imageFile);
}

async function reviewIdVerification(req, res) {
  const db = await loadAdminState();
  const caller = db.users.find(u => u.id === req.user.id);
  if (!caller || (caller.role !== 'admin' && caller.role !== 'escrow')) return res.status(403).json({ success: false, error: 'Forbidden' });
  const { approve, reason } = req.body || {};
  const user = db.users.find(u => u.id === req.params.userId);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  if (user.idVerificationStatus !== 'pending') return res.status(400).json({ success: false, error: 'This user has no pending ID verification request.' });

  const documentKey = user.verificationDocument?.imageFile || null;
  if (approve) {
    user.idVerified = true;
    user.idVerifiedAt = new Date().toISOString();
    user.idVerificationStatus = 'approved';
    user.idVerifiedBy = caller.id;
  } else {
    user.idVerificationStatus = 'rejected';
    user.idVerificationRejectedReason = reason || 'Document could not be verified';
    user.idVerificationRejectedAt = new Date().toISOString();
  }
  if (user.verificationDocument) { user.verificationDocument.imageFile = null; user.verificationDocument.purgedAt = new Date().toISOString(); }
  await saveAdminState(db);
  if (documentKey) storageService.deleteObject(documentKey, 'private').catch(() => {});
  res.json({ success: true, idVerified: !!user.idVerified, status: user.idVerificationStatus });
}

module.exports = { banUser, unbanUser, makeEscrow, removeEscrow, banEscrow, changeUserRole, createAdSpace, listAdSpaces, listUsers, listEscrows, getStats, getDailyActiveUsers, listAdminProducts, listChats, getAdminComments, getAdminReviews, banIpAddress, unbanIpAddress, listBannedIps, listIdVerifications, getIdVerificationImage, reviewIdVerification };

