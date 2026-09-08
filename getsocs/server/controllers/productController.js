const crypto = require('crypto');
const { loadProductState, saveProductState, loadPublicProductCatalogState, loadPublicProductByIdState, incrementProductPageView } = require('../repositories/productRepository');
const { validateProductInput, sanitizeSearchQuery, sanitizeTextField } = require('../utils/inputValidation');
const { cleanupFiles } = require('../middleware/imageDimensionMiddleware');
const { verifyChannel, supportsAutoVerification } = require('../services/channelVerificationService');
const cacheService = require('../services/cacheService');
const { cacheKeys } = require('../utils/cacheKeys');
const logger = require('../utils/logger');
const storageService = require('../services/storageService');
const { invalidateProductCaches } = require('../services/productCacheService');

const PRODUCT_LIST_TTL = Math.max(10, Number(process.env.CACHE_PRODUCT_LIST_TTL_SECONDS || 60));
const PRODUCT_DETAIL_TTL = Math.max(10, Number(process.env.CACHE_PRODUCT_DETAIL_TTL_SECONDS || 180));


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

  // Sanitize search query to prevent injection attacks
  const search = sanitizeSearchQuery(query.search?.toString());
  if (search) {
    const haystack = `${product.title} ${product.description} ${product.platform} ${product.topic}`.toLowerCase();
    const sellerName = (db.users.find(u => u.id === product.sellerId) || {}).username || '';
    if (!haystack.includes(search.toLowerCase()) && !sellerName.toLowerCase().includes(search.toLowerCase())) return false;
  }

  const minPrice = Number(query.minPrice);
  if (!Number.isNaN(minPrice)) {
    if (product.price < minPrice) return false;
  }

  const maxPrice = Number(query.maxPrice);
  if (!Number.isNaN(maxPrice)) {
    if (product.price > maxPrice) return false;
  }

  // Validate platform enum
  if (query.platform) {
    const validPlatforms = ['youtube', 'twitch', 'tiktok', 'instagram', 'twitter', 'discord', 'telegram', 'other'];
    if (validPlatforms.includes(query.platform.toString().toLowerCase())) {
      if (product.platform.toLowerCase() !== query.platform.toString().toLowerCase()) return false;
    }
  }

  // Validate topic enum
  if (query.topic) {
    const validTopics = ['gaming', 'education', 'entertainment', 'music', 'finance', 'technology', 'health', 'other'];
    if (validTopics.includes(query.topic.toString().toLowerCase())) {
      if (product.topic.toLowerCase() !== query.topic.toString().toLowerCase()) return false;
    }
  }

  // Validate sellerId format (should be numeric or UUID-like)
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

async function getProducts(req, res) {
  try {
    // Analytics is deliberately decoupled from the catalog state. The old
    // implementation loaded and rewrote the whole database merely to record
    // one page view, turning every GET into an expensive write.
    incrementProductPageView().catch(error => logger.warn('Page-view increment failed', { error }));

    const anonymous = !req.user?.id;
    const key = req.query?.search ? cacheKeys.productSearch(req.query) : cacheKeys.productList(req.query);
    const buildResponse = async () => {
      const db = anonymous ? await loadPublicProductCatalogState() : await loadProductState();
      const userId = req.user?.id;
      const userRole = req.user?.role;
      let products = Array.isArray(db.products) ? db.products : [];
      products = products.filter(p => p.status === 'approved' && !p.hidden);

      if (req.query && Object.keys(req.query).length > 0) products = products.filter(p => productMatchesFilters(p, req.query, db));

      const total = products.length;
      const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;
      const page = Math.max(1, Number.parseInt(req.query.page || '1', 10) || 1);
      const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit || '20', 10) || 20));
      const selected = hasPagination ? products.slice((page - 1) * limit, page * limit) : products;
      const filtered = selected.map(p => normalizeProduct(p, db, userId, userRole));
      return {
        success: true,
        data: filtered,
        meta: { page: hasPagination ? page : 1, limit: hasPagination ? limit : total, total, pages: hasPagination ? Math.ceil(total / limit) : (total ? 1 : 0) }
      };
    };

    if (anonymous) {
      const cached = await cacheService.getOrSet(key, PRODUCT_LIST_TTL, buildResponse);
      res.setHeader('X-Cache', cached.cache);
      return res.json(cached.value);
    }
    return res.json(await buildResponse());
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getMyProducts(req, res) {
  try {
    const db = await loadProductState();
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
  const storedImageKeys = [];
  try {
    // Input validation: Sanitize and validate all product fields
    const productValidation = validateProductInput(req.body);
    if (!productValidation.valid) {
      cleanupFiles(req.files);
      return res.status(400).json({
        success: false,
        error: 'Invalid product data',
        errors: productValidation.errors
      });
    }
    
    const { title, description, price, platform, followers, avgViews, topic, monetized, channelUrl } = productValidation.data;
    const files = req.files;
    const { uploadSessionCode } = req.body;

    // Validate file uploads
    if (!Array.isArray(files) || files.length < 3) {
      cleanupFiles(files);
      return res.status(400).json({ success: false, error: 'At least 3 product images are required' });
    }
    if (files.length > 7) {
      cleanupFiles(files);
      return res.status(400).json({ success: false, error: 'A maximum of 7 product images is allowed' });
    }

    const db = await loadProductState();
    const userId = req.user.id;
    const user = db.users.find(u => u.id === userId);
    if (!user) {
      cleanupFiles(files);
      return res.status(401).json({ success: false, error: 'User not found' });
    }
    
    // Whitelist user roles
    const allowedRoles = ['user', 'seller', 'admin'];
    if (!allowedRoles.includes(user.role)) {
      cleanupFiles(files);
      return res.status(403).json({ success: false, error: 'Forbidden to post products' });
    }

    // Channel ownership verification (any platform that supports it) - the
    // verified stats below are what gets saved; anything the browser sent
    // for followers/avgViews/title is discarded once a channel verifies.
    let verifiedChannel = null;
    if (channelUrl && supportsAutoVerification(platform)) {
      const validation = await verifyChannel(platform, channelUrl, uploadSessionCode || '');
      if (!validation.ok) {
        cleanupFiles(files);
        return res.status(400).json({ success: false, error: validation.error || `${platform} channel verification failed.` });
      }
      verifiedChannel = validation.data;
    }

    // Generate unique product code
    let code;
    do {
      code = crypto.randomBytes(20).toString('hex');
    } while (db.products.some(product => product.code === code));

    const prod = {
      id: Date.now().toString(),
      code,
      uploadSessionCode: uploadSessionCode ? String(uploadSessionCode).substring(0, 100) : '',
      channelUrl: channelUrl || '',
      // Never trust browser-supplied channel stats after ownership has been verified
      title: verifiedChannel?.title || title,
      description,
      price: Number(price),
      platform: platform,
      followers: verifiedChannel?.followerCount ?? (followers || 0),
      avgViews: verifiedChannel?.avgViews ?? (avgViews || 0),
      topic: topic,
      monetized: String(platform).toLowerCase() === 'youtube' && Boolean(monetized),
      sellerId: userId,
      createdAt: new Date().toISOString(),
      status: 'pending',
      hidden: false,
      promoted: false,
      premium: false,
      channelInfoLocked: Boolean(verifiedChannel),
      channelInfoVerifiedAt: verifiedChannel ? new Date().toISOString() : null,
      channelId: verifiedChannel?.channelId || '',
      images: []
    };

    for (const file of files) {
      const key = await storageService.putFile(file.path, { visibility: 'public', prefix: `products/${prod.id}` });
      storedImageKeys.push(key);
    }
    prod.images = [...storedImageKeys];

    db.products.push(prod);
    await saveProductState(db);
    await invalidateProductCaches(prod.id);
    await storageService.cleanupStaging(files);
    res.json({ success: true, data: normalizeProduct(prod, db, userId, user.role) });
  } catch (e) {
    await Promise.allSettled(storedImageKeys.map(key => storageService.deleteObject(key, 'public')));
    cleanupFiles(req.files);
    res.status(500).json({ success: false, error: e.message });
  }
}

async function commentProduct(req, res) {
  try {
    const { text } = req.body;
    if (!text || text.trim().length === 0) return res.status(400).json({ success: false, error: 'Comment required' });
    const db = await loadProductState();
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
    await saveProductState(db);
    await invalidateProductCaches(p.id);
    res.json({ success: true, comment: c });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function editComment(req, res) {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({ success: false, error: 'Comment text required' });
    const db = await loadProductState();
    const comment = (db.comments || []).find(c => c.id === req.params.commentId && c.productId === req.params.id);
    if (!comment) return res.status(404).json({ success: false, error: 'Comment not found' });
    if (comment.userId !== req.user.id) {
      return res.status(403).json({ success: false, error: 'You can only edit your own comments' });
    }
    comment.text = text.trim();
    comment.editedAt = new Date().toISOString();
    await saveProductState(db);
    await invalidateProductCaches(req.params.id);
    res.json({ success: true, comment });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function deleteComment(req, res) {
  try {
    const db = await loadProductState();
    const caller = db.users.find(u => u.id === req.user.id);
    const comment = (db.comments || []).find(c => c.id === req.params.commentId && c.productId === req.params.id);
    if (!comment) return res.status(404).json({ success: false, error: 'Comment not found' });
    const isOwner = comment.userId === req.user.id;
    const isModerator = caller && (caller.role === 'admin' || caller.role === 'escrow');
    if (!isOwner && !isModerator) {
      return res.status(403).json({ success: false, error: 'Not allowed to delete this comment' });
    }
    db.comments = (db.comments || []).filter(c => c.id !== req.params.commentId);
    await saveProductState(db);
    await invalidateProductCaches(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getProduct(req, res) {
  try {
    const anonymous = !req.user?.id;
    const buildResponse = async () => {
      const db = anonymous ? await loadPublicProductByIdState(req.params.id) : await loadProductState();
      const p = db.products.find(x => x.id === req.params.id);
      if (!p) return { status: 404, body: { success: false, error: 'Product not found' } };
      const userId = req.user?.id;
      const userRole = req.user?.role;
      const canSeeNonPublic = userId && (p.sellerId === userId || userRole === 'admin' || userRole === 'escrow');
      if ((p.status !== 'approved' || p.hidden) && !canSeeNonPublic) {
        return { status: 404, body: { success: false, error: 'Product not found' } };
      }
      return { status: 200, body: { success: true, data: normalizeProduct(p, db, userId, userRole) } };
    };
    if (anonymous) {
      const key = cacheKeys.productDetail(req.params.id);
      const cached = await cacheService.getOrSet(key, PRODUCT_DETAIL_TTL, buildResponse);
      res.setHeader('X-Cache', cached.cache);
      return res.status(cached.value.status).json(cached.value.body);
    }
    const result = await buildResponse();
    return res.status(result.status).json(result.body);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getPendingProducts(req, res) {
  const db = await loadProductState();
  const pending = db.products
    .filter(p => p.status === 'pending')
    .map(p => ({ ...p, sellerName: (db.users.find(u => u.id === p.sellerId) || {}).username || p.sellerId }));
  res.json({ success: true, data: pending });
}

async function approveProduct(req, res) {
  try {
    const { code } = req.body;
    const db = await loadProductState();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (product.status !== 'pending') return res.status(400).json({ success: false, error: 'Product is not pending approval' });
    if (!code || code !== product.code) return res.status(400).json({ success: false, error: 'Invalid approval code' });

    product.status = 'approved';
    product.approvedAt = new Date().toISOString();
    await saveProductState(db);
    await invalidateProductCaches(product.id);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function deleteProduct(req, res) {
  try {
    const db = await loadProductState();
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

    await saveProductState(db);
    await invalidateProductCaches(deleted.id);
    await Promise.allSettled((deleted.images || []).map(key => storageService.deleteObject(key, 'public')));
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

async function getExpiringProducts(req, res) {
  try {
    const query = { ...req.query, __view: 'expiring' };
    const key = cacheKeys.productList(query);
    const cached = await cacheService.getOrSet(key, PRODUCT_LIST_TTL, async () => {
      const db = await loadPublicProductCatalogState();
      const now = new Date();
      const products = (db.products || []).filter(product => {
        const createdAt = new Date(product.createdAt);
        const deltaHours = (now - createdAt) / (1000 * 60 * 60);
        return product.status === 'approved' && !product.hidden && deltaHours <= 48;
      });
      return { success: true, data: products.map(p => normalizeProduct(p, db, undefined, undefined)) };
    });
    res.setHeader('X-Cache', cached.cache);
    res.json(cached.value);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function promoteProduct(req, res) {
  try {
    const db = await loadProductState();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (req.user.id !== product.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    product.promoted = true;
    product.promotedAt = new Date().toISOString();
    await saveProductState(db);
    await invalidateProductCaches(product.id);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function markPremiumProduct(req, res) {
  try {
    const db = await loadProductState();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (req.user.id !== product.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    product.premium = true;
    product.premiumAt = new Date().toISOString();
    await saveProductState(db);
    await invalidateProductCaches(product.id);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function hideProduct(req, res) {
  try {
    const db = await loadProductState();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (req.user.id !== product.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    product.hidden = true;
    await saveProductState(db);
    await invalidateProductCaches(product.id);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function publicizeProduct(req, res) {
  try {
    const db = await loadProductState();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (req.user.id !== product.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    product.hidden = false;
    await saveProductState(db);
    await invalidateProductCaches(product.id);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function claimProduct(req, res) {
  try {
    const db = await loadProductState();
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
    await saveProductState(db);
    await invalidateProductCaches(product.id);
    res.json({ success: true, data: { code, productId: product.id } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function submitProductClaim(req, res) {
  try {
    const db = await loadProductState();
    const product = db.products.find(x => x.id === req.params.id);
    if (!product) return res.status(404).json({ success: false, error: 'Product not found' });
    if (!product.claim || product.claim.userId !== req.user.id) {
      return res.status(400).json({ success: false, error: 'No pending claim for this listing from your account.' });
    }
    product.claim.status = 'submitted';
    product.claim.submittedAt = new Date().toISOString();
    await saveProductState(db);
    await invalidateProductCaches(product.id);
    res.json({ success: true, data: product.claim });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function listProductClaims(req, res) {
  const db = await loadProductState();
  const claims = db.products
    .filter(p => p.claim && p.claim.status === 'submitted')
    .map(p => ({ productId: p.id, productTitle: p.title, sellerId: p.sellerId, ...p.claim }));
  res.json({ success: true, data: claims });
}

async function resolveProductClaim(req, res) {
  try {
    const { code, approve } = req.body;
    const db = await loadProductState();
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
    await saveProductState(db);
    await invalidateProductCaches(product.id);
    res.json({ success: true, data: product });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function lookupChannel(req, res) {
  try {
    const { platform, url, verificationCode } = req.query;
    if (!supportsAutoVerification(platform)) {
      return res.status(200).json({ success: false, error: `Automatic verification is not available for ${platform}.` });
    }
    const result = await verifyChannel(platform, url, verificationCode);
    if (!result.ok) {
      return res.status(200).json({ success: false, error: result.error });
    }
    return res.json({ success: true, data: result.data });
  } catch (e) {
    console.error('lookupChannel error:', e.message);
    res.status(500).json({ success: false, error: 'Failed to fetch channel info.' });
  }
}

module.exports = {
  getProducts,
  getMyProducts,
  createProduct,
  commentProduct,
  editComment,
  deleteComment,
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
  resolveProductClaim,
  lookupChannel
};
