const crypto = require('crypto');
const { readDB, writeDB } = require('../config/db');
const { getYoutubeChannelMetadata } = require('./youtubeController');

function generateShortCode(length = 6) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(crypto.randomInt(0, chars.length));
  }
  return result;
}

function hideProductCode(product, userId, userRole) {
  if (!product) return product;
  const shouldShowCode = userRole === 'admin' || userRole === 'escrow' || product.sellerId === userId;
  if (!shouldShowCode) {
    const copy = { ...product };
    delete copy.code;
    return copy;
  }
  return product;
}

function getCommentsForProduct(db, productId) {
  const topLevel = (db.comments || []).filter(c => c.productId === productId);
  const nested = db.products.find(p => p.id === productId)?.comments || [];
  return [...nested, ...topLevel];
}

function normalizeProduct(product, db, userId, userRole) {
  if (!product) return null;
  const normalized = {
    ...product,
    images: Array.isArray(product.images) ? product.images : product.image ? [product.image] : [],
    comments: getCommentsForProduct(db, product.id)
  };
  const withCode = hideProductCode(normalized, userId, userRole);
  if (!userId) {
    // Logged-out visitors can browse images/price/platform only - no
    // description or seller identity until they sign in.
    delete withCode.description;
    delete withCode.sellerId;
    delete withCode.sellerName;
    withCode.descriptionLocked = true;
  }
  return withCode;
}

function parseBooleanValue(value) {
  return value === true || value === 'true' || value === '1' || value === 'yes';
}

function productMatchesFilters(product, query, db) {
  if (!product) return false;

  const search = query.search?.toString().toLowerCase();
  if (search) {
    const haystack = `${product.title} ${product.description} ${product.platform} ${product.topic}`.toLowerCase();
    const sellerName = (db.users.find(u => u.id === product.sellerId) || {}).username || '';
    if (!haystack.includes(search) && !sellerName.toLowerCase().includes(search)) return false;
  }

  const minPrice = Number(query.minPrice);
  if (!Number.isNaN(minPrice)) {
    if (product.price < minPrice) return false;
  }

  const maxPrice = Number(query.maxPrice);
  if (!Number.isNaN(maxPrice)) {
    if (product.price > maxPrice) return false;
  }

  if (query.platform) {
    if (product.platform.toLowerCase() !== query.platform.toString().toLowerCase()) return false;
  }

  if (query.topic) {
    if (product.topic.toLowerCase() !== query.topic.toString().toLowerCase()) return false;
  }

  if (query.sellerId) {
    if (product.sellerId !== query.sellerId) return false;
  }

  if (query.promoted && !product.promoted) return false;
  if (query.premium && !product.premium) return false;

  const live = parseBooleanValue(query.live);
  if (live) {
    const createdAt = new Date(product.createdAt);
    const now = new Date();
    const deltaHours = (now - createdAt) / (1000 * 60 * 60);
    if (deltaHours > 48) return false;
  }

  return true;
}

function getProducts(req, res) {
  try {
    const db = readDB();
    const userId = req.user?.id;
    const userRole = req.user?.role;
    db.analytics = db.analytics || { pageViews: 0 };
    db.analytics.pageViews += 1;
    writeDB(db);

    let products = Array.isArray(db.products) ? db.products : [];
    products = products.filter(p => p.status === 'approved' && !p.hidden);

    if (req.query && Object.keys(req.query).length > 0) {
      products = products.filter(p => productMatchesFilters(p, req.query, db));
    }

    const filtered = products.map(p => normalizeProduct(p, db, userId, userRole));
    res.json({ success: true, data: filtered });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getMyProducts(req, res) {
  try {
    const db = readDB();
    if (!req.user?.id) return res.status(401).json({ success: false, error: 'No token' });
    const userId = req.user.id;
    const userRole = req.user.role;
    const products = (Array.isArray(db.products) ? db.products : [])
      .filter(product => product.sellerId === userId)
      .map(product => normalizeProduct(product, db, userId, userRole));
    res.json({ success: true, data: products });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function createProduct(req, res) {
  try {
    const { title, description, price, platform, followers, avgViews, topic, monetized, uploadSessionCode, channelUrl } = req.body;
    const files = req.files;

    if (!title) return res.status(400).json({ success: false, error: 'Title required' });
    if (!price || Number(price) <= 0) return res.status(400).json({ success: false, error: 'Valid price required' });
    if (!Array.isArray(files) || files.length < 3) return res.status(400).json({ success: false, error: 'At least 3 product images are required' });
    if (files.length > 7) return res.status(400).json({ success: false, error: 'A maximum of 7 product images is allowed' });

    const db = readDB();
    const userId = req.user.id;
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    const allowed = ['user', 'seller', 'admin'];
    if (!allowed.includes(user.role)) return res.status(403).json({ success: false, error: 'Forbidden to post products' });

    let verifiedChannel = null;
    if (platform === 'YouTube' && channelUrl) {
      const validation = await getYoutubeChannelMetadata(channelUrl, uploadSessionCode);
      if (!validation.ok) {
        return res.status(400).json({ success: false, error: validation.error || 'YouTube channel verification failed.' });
      }
      verifiedChannel = validation.data;
    }

    let code;
    do {
      code = crypto.randomBytes(20).toString('hex');
    } while (db.products.some(product => product.code === code));

    const prod = {
      id: Date.now().toString(),
      code,
      uploadSessionCode: uploadSessionCode || '',
      channelUrl: channelUrl || '',
      // Never trust browser-supplied channel stats after ownership has been
      // verified. Keep the verified snapshot as the listing's record.
      title: verifiedChannel?.title || title,
      description,
      price: Number(price),
      platform: platform || 'Other',
      followers: verifiedChannel?.subscriberCount ?? (Number(followers) || 0),
      avgViews: verifiedChannel?.avgViews ?? (Number(avgViews) || 0),
      topic: topic || 'Other',
      monetized: monetized === '1' || monetized === true || monetized === 'true',
      sellerId: userId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      hidden: false,
      promoted: false,
      premium: false,
      channelInfoLocked: Boolean(verifiedChannel),
      channelInfoVerifiedAt: verifiedChannel ? new Date().toISOString() : null,
      channelId: verifiedChannel?.channelId || '',
      images: files.map(file => file.filename)
    };

    db.products.push(prod);
    writeDB(db);
    res.json({ success: true, data: normalizeProduct(prod, db, userId, user.role) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function commentProduct(req, res) {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ success: false, error: 'Comment required' });
    const db = readDB();
    const p = db.products.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ success: false, error: 'Product not found' });

    const c = {
      id: Date.now().toString(),
      productId: p.id,
      userId: req.user.id,
      text: text.trim(),
      ts: new Date().toISOString()
    };

    db.comments = db.comments || [];
    db.comments.push(c);
    writeDB(db);
    res.json({ success: true, comment: c });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getProduct(req, res) {
  try {
    const db = readDB();
    const p = db.products.find(x => x.id === req.params.id);
    if (!p) return res.status(404).json({ success: false, error: 'Product not found' });
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const filtered = normalizeProduct(p, db, userId, userRole);
    res.json({ success: true, data: filtered });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getPendingProducts(req, res) {
  const db = readDB();
  const pending = db.products
    .filter(p => p.status === 'pending')
    .map(p => ({ ...p, sellerName: (db.users.find(u => u.id === p.sellerId) || {}).username || p.sellerId }));
  res.json({ success: true, data: pending });
}

function approveProduct(req, res) {
  try {
    const { code } = req.body;
    const db = readDB();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (product.status !== 'pending') return res.status(400).json({ success: false, error: 'Product is not pending approval' });
    if (!code || code !== product.code) return res.status(400).json({ success: false, error: 'Invalid approval code' });

    product.status = 'approved';
    product.approvedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function deleteProduct(req, res) {
  try {
    const db = readDB();
    const productIndex = db.products.findIndex(x => x.id === req.params.id);
    if (productIndex === -1) return res.status(404).json({ success: false, error: 'Product not found' });
    const [deleted] = db.products.splice(productIndex, 1);

    const deletedTxIds = [];
    if (Array.isArray(db.transactions)) {
      deletedTxIds.push(...db.transactions.filter(tx => tx.productId === deleted.id).map(tx => tx.id));
      db.transactions = db.transactions.filter(tx => tx.productId !== deleted.id);
    }
    if (Array.isArray(db.chats)) {
      db.chats = db.chats.filter(chat => !deletedTxIds.includes(chat.txId));
    }

    writeDB(db);
    res.json({ success: true, data: deleted });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getLiveProducts(req, res) {
  try {
    req.query = { ...req.query, live: true };
    return getProducts(req, res);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getPromotedProducts(req, res) {
  try {
    req.query = { ...req.query, promoted: true };
    return getProducts(req, res);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getPremiumProducts(req, res) {
  try {
    req.query = { ...req.query, premium: true };
    return getProducts(req, res);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getExpiringProducts(req, res) {
  try {
    const db = readDB();
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const now = new Date();
    const products = (db.products || []).filter(product => {
      const createdAt = new Date(product.createdAt);
      const deltaHours = (now - createdAt) / (1000 * 60 * 60);
      return product.status === 'approved' && !product.hidden && deltaHours <= 48;
    });
    const output = products.map(p => normalizeProduct(p, db, userId, userRole));
    res.json({ success: true, data: output });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function promoteProduct(req, res) {
  try {
    const db = readDB();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (req.user.id !== product.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    product.promoted = true;
    product.promotedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function markPremiumProduct(req, res) {
  try {
    const db = readDB();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (req.user.id !== product.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    product.premium = true;
    product.premiumAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function hideProduct(req, res) {
  try {
    const db = readDB();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (req.user.id !== product.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    product.hidden = true;
    writeDB(db);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function publicizeProduct(req, res) {
  try {
    const db = readDB();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (req.user.id !== product.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    product.hidden = false;
    writeDB(db);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function claimProduct(req, res) {
  try {
    const db = readDB();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (product.sellerId === req.user.id) {
      return res.status(400).json({ success: false, error: 'You already own this listing.' });
    }
    const code = generateShortCode();
    product.claim = {
      userId: req.user.id,
      code,
      status: 'pending', // pending -> submitted -> approved | rejected
      requestedAt: new Date().toISOString()
    };
    writeDB(db);
    res.json({ success: true, data: { code, productId: product.id } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function submitProductClaim(req, res) {
  try {
    const db = readDB();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (!product.claim || product.claim.userId !== req.user.id) {
      return res.status(400).json({ success: false, error: 'No pending claim for this listing from your account.' });
    }
    product.claim.status = 'submitted';
    product.claim.submittedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, data: product.claim });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function listProductClaims(req, res) {
  const db = readDB();
  const claims = db.products
    .filter(p => p.claim && p.claim.status === 'submitted')
    .map(p => ({ productId: p.id, productTitle: p.title, sellerId: p.sellerId, ...p.claim }));
  res.json({ success: true, data: claims });
}

function resolveProductClaim(req, res) {
  try {
    const { code, approve } = req.body;
    const db = readDB();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product || !product.claim) return res.status(404).json({ success: false, error: 'No claim found for this listing.' });
    if (product.claim.status !== 'submitted') return res.status(400).json({ success: false, error: 'This claim is not awaiting review.' });
    if (!code || code !== product.claim.code) return res.status(400).json({ success: false, error: 'Verification code does not match.' });

    if (approve) {
      // Ownership dispute upheld: take the listing off the market. The
      // rightful owner is now free to upload it themselves.
      product.claim.status = 'approved';
      product.claim.resolvedAt = new Date().toISOString();
      product.hidden = true;
      product.status = 'removed_claimed';
    } else {
      product.claim.status = 'rejected';
      product.claim.resolvedAt = new Date().toISOString();
    }
    writeDB(db);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = {
  getProducts,
  getMyProducts,
  createProduct,
  commentProduct,
  getProduct,
  getPendingProducts,
  approveProduct,
  deleteProduct,
  getLiveProducts,
  getPromotedProducts,
  getPremiumProducts,
  getExpiringProducts,
  promoteProduct,
  markPremiumProduct,
  hideProduct,
  publicizeProduct,
  claimProduct,
  submitProductClaim,
  listProductClaims,
  resolveProductClaim
};
