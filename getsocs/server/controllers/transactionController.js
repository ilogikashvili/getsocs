const { loadTransactionState, saveTransactionState, withTransactionState } = require('../repositories/transactionRepository');
const { isUserOnline } = require('../utils/presence');
const MembershipService = require('../services/membershipService');
const { invalidateProductCaches } = require('../services/productCacheService');
const { getIdempotencyKey, findExisting, saveResult } = require('../middleware/idempotency');

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://getsocs.com').replace(/\/$/, '');

function formatMoney(value) {
  const amount = Number(value) || 0;
  return `$${amount.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function escapeMarkdownLinkText(value) {
  return String(value || 'Channel').replace(/[[\]\\]/g, '\\$&');
}

function getSellerTransferTarget(seller) {
  return seller.payoutEmail || seller.paymentEmail || seller.paypalEmail || seller.email || seller.username || seller.id;
}

function buildPurchaseRequestText(tx) {
  const productTitle = escapeMarkdownLinkText(tx.productTitle || tx.productId);
  const productUrl = tx.productUrl || `${FRONTEND_URL}/product/${tx.productId}`;

  return [
    `Request to purchase "[${productTitle}](${productUrl})"`,
    '',
    `**Transaction ID:** ${tx.id}`,
    '',
    `**Transaction amount:** ${formatMoney(tx.productPrice || tx.listingPrice || tx.totalPrice)}`,
    '',
    `**Transfer to:** ${tx.sellerTransferTo || tx.sellerEmail || tx.sellerName}`,
    '',
    '**Transaction steps when using the escrow service:**',
    '',
    '1. The buyer pays the cost of the channel +4-8% ($3 minimum) service fee.',
    '2. The seller designates the escrow agent as owner.',
    '3. The escrow agent verifies everything and assigns manager rights to the buyer.',
    '4. After 7 days, the escrow agent removes all the other managers and assigns primary ownership rights to the buyer (7 days is the minimum amount of time required in order to assign a new primary owner in the control panel.)',
    '5. We send the funds to the seller. Money is sent instantly through all payment systems.'
  ].join('\n');
}

function buildPurchaseRequestMessage(buyer, tx, now) {
  return {
    id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: buyer.id,
    senderName: buyer.username || 'Buyer',
    senderRole: buyer.role || 'user',
    text: buildPurchaseRequestText(tx),
    type: 'purchase_request',
    ts: now
  };
}

function enrichTx(db, tx) {
  const buyer = db.users.find(u => u.id === tx.buyerId);
  const seller = db.users.find(u => u.id === tx.sellerId);
  const escrow = tx.escrowId ? db.users.find(u => u.id === tx.escrowId) : null;
  return {
    ...tx,
    escrowName: escrow ? escrow.username : (tx.escrowName || null),
    buyerOnline: isUserOnline(buyer),
    sellerOnline: isUserOnline(seller),
    escrowOnline: escrow ? isUserOnline(escrow) : false
  };
}

async function buyProduct(req, res) {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey === false) return res.status(400).json({ success: false, error: 'Invalid Idempotency-Key format' });

    // Membership reads are done before entering the write transaction so the
    // MySQL state lock is held only for the correctness-critical mutation.
    const serviceFeeRate = await MembershipService.getPlatformFee(req.user.id);

    const result = await withTransactionState(async db => {
      if (idempotencyKey) {
        const previous = findExisting(db, idempotencyKey, req);
        if (previous?.conflict) return { statusCode: 409, body: { success: false, error: 'Idempotency-Key was already used for a different request' } };
        if (previous) return { statusCode: previous.statusCode, body: previous.body, productId: req.params.id };
      }

      const prod = db.products.find(p => p.id === req.params.id);
      if (!prod) return { statusCode: 404, body: { success: false, error: 'Product not found' } };
      if (prod.status !== 'approved' || prod.hidden) {
        return { statusCode: 409, body: { success: false, error: 'Product is not currently available for purchase' }, productId: prod.id };
      }

      const buyer = db.users.find(u => u.id === req.user.id);
      if (!buyer) return { statusCode: 401, body: { success: false, error: 'Buyer missing' } };
      if (prod.sellerId === buyer.id) return { statusCode: 400, body: { success: false, error: 'Cannot buy your own product' } };
      const seller = db.users.find(u => u.id === prod.sellerId);
      if (!seller) return { statusCode: 409, body: { success: false, error: 'Seller is no longer available' } };

      // A listing is single-inventory. Once any buyer has an active purchase,
      // another checkout must not be allowed to race it.
      const active = db.transactions.find(t =>
        (t.productId === prod.id || t.listingId === prod.id) &&
        ['pending', 'escrow_active'].includes(t.status)
      );
      if (active) {
        const sameBuyer = active.buyerId === buyer.id;
        if (sameBuyer) {
          const body = { success: true, tx: active };
          if (idempotencyKey) saveResult(db, idempotencyKey, req, 200, body);
          return { statusCode: 200, body, productId: prod.id };
        }
        return {
          statusCode: 409,
          body: { success: false, error: 'Product is reserved by another transaction' },
          productId: prod.id
        };
      }

      const ALLOWED_PAYMENT_METHODS = ['card', 'paypal', 'crypto', 'bank_transfer'];
      const paymentMethod = ALLOWED_PAYMENT_METHODS.includes(req.body?.paymentMethod) ? req.body.paymentMethod : 'card';
      const serviceFee = Math.max(3, Math.round(prod.price * serviceFeeRate * 100) / 100);
      const now = new Date().toISOString();
      const tx = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        productId: prod.id,
        productTitle: prod.title,
        productUrl: prod.channelUrl || prod.url || `${FRONTEND_URL}/product/${prod.id}`,
        productPrice: prod.price,
        serviceFee,
        totalPrice: Math.round((Number(prod.price) + serviceFee) * 100) / 100,
        paymentMethod,
        buyerId: buyer.id,
        buyerName: buyer.username,
        buyerEmail: buyer.email,
        sellerId: seller.id,
        sellerName: seller.username,
        sellerEmail: seller.email,
        sellerTransferTo: getSellerTransferTarget(seller),
        status: 'pending',
        stage: 'waiting',
        createdAt: now
      };

      db.transactions.push(tx);
      if (!db.chats) db.chats = [];
      db.chats.push({
        id: tx.id,
        txId: tx.id,
        messages: [buildPurchaseRequestMessage(buyer, tx, now)],
        readAt: { [buyer.id]: now },
        createdAt: now
      });
      prod.status = 'reserved';
      prod.reservedBy = buyer.id;
      prod.reservedTransactionId = tx.id;
      prod.reservedAt = now;

      const body = { success: true, tx };
      if (idempotencyKey) saveResult(db, idempotencyKey, req, 200, body);
      return { statusCode: 200, body, productId: prod.id };
    });

    if (result.productId) await invalidateProductCaches(result.productId);
    return res.status(result.statusCode).json(result.body);
  } catch (e) {
    if (e?.code === 'STATE_VERSION_CONFLICT') return res.status(409).json({ success: false, error: 'Product availability changed; please retry' });
    return res.status(500).json({ success: false, error: e.message });
  }
}

async function listTransactions(req, res) {
  try {
    const db = await loadTransactionState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    if (user.role === 'escrow' || user.role === 'admin') return res.json({ success: true, data: db.transactions.map(t => enrichTx(db, t)) });
    const out = db.transactions.filter(t => t.buyerId === user.id || t.sellerId === user.id).map(t => enrichTx(db, t));
    res.json({ success: true, data: out });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function pendingTransactions(req, res) {
  try {
    const db = await loadTransactionState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || (user.role !== 'escrow' && user.role !== 'admin')) return res.status(403).json({ success: false, error: 'Forbidden' });
    const pending = db.transactions.filter(t => t.status === 'pending');
    res.json({ success: true, data: pending });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function confirmTransaction(req, res) {
  try {
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey === false) return res.status(400).json({ success: false, error: 'Invalid Idempotency-Key format' });

    const result = await withTransactionState(async db => {
      if (idempotencyKey) {
        const previous = findExisting(db, idempotencyKey, req);
        if (previous?.conflict) return { statusCode: 409, body: { success: false, error: 'Idempotency-Key was already used for a different request' } };
        if (previous) return { statusCode: previous.statusCode, body: previous.body };
      }

      const user = db.users.find(u => u.id === req.user.id);
      if (!user || (user.role !== 'escrow' && user.role !== 'admin')) return { statusCode: 403, body: { success: false, error: 'Forbidden' } };
      const tx = db.transactions.find(t => t.id === req.params.id);
      if (!tx) return { statusCode: 404, body: { success: false, error: 'Tx not found' } };
      if (tx.status === 'completed') return { statusCode: 409, body: { success: false, error: 'Transaction is already completed' } };
      if (tx.status === 'refunded' || tx.status === 'cancelled') return { statusCode: 409, body: { success: false, error: `Transaction is ${tx.status}` } };

      const buyer = db.users.find(u => u.id === tx.buyerId);
      if (buyer) buyer.pointsBought = (buyer.pointsBought || 0) + (tx.productPrice || tx.listingPrice || 0);
      const seller = db.users.find(u => u.id === tx.sellerId);
      if (seller) seller.pointsSold = (seller.pointsSold || 0) + (tx.productPrice || tx.listingPrice || 0);

      const now = new Date().toISOString();
      tx.status = 'completed';
      tx.stage = 'payment';
      tx.completedAt = now;

      const productId = tx.productId || tx.listingId;
      const product = db.products.find(p => p.id === productId);
      if (product) {
        product.status = 'sold';
        product.soldAt = now;
        product.soldTo = tx.buyerId;
        product.soldTransactionId = tx.id;
        delete product.reservedBy;
        delete product.reservedAt;
        delete product.reservedTransactionId;
      }

      const body = { success: true, tx };
      if (idempotencyKey) saveResult(db, idempotencyKey, req, 200, body);
      return { statusCode: 200, body, productId };
    });

    if (result.productId) await invalidateProductCaches(result.productId);
    return res.status(result.statusCode).json(result.body);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

async function getTransaction(req, res) {
  try {
    const db = await loadTransactionState();
    const user = db.users.find(u => u.id === req.user.id);
    const tx = db.transactions.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });
    
    // Only allow access if user is:
    // - The buyer
    // - The seller
    // - An escrow agent or admin
    if (user.id !== tx.buyerId && user.id !== tx.sellerId && user.role !== 'admin' && user.role !== 'escrow') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    
    res.json({ success: true, data: enrichTx(db, tx) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function setTransactionStage(req, res) {
  try {
    const db = await loadTransactionState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || (user.role !== 'escrow' && user.role !== 'admin')) return res.status(403).json({ success: false, error: 'Forbidden' });
    const tx = db.transactions.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ success: false, error: 'Tx not found' });
    const { stage } = req.body;
    if (!stage) return res.status(400).json({ success: false, error: 'Stage required' });
    tx.stage = stage;
    // "delivered" marks the point where escrow has received the account
    // credentials from the seller - start the 7-day (7*24h) holding countdown.
    if (stage === 'delivered' && !tx.credentialsReceivedAt) {
      tx.credentialsReceivedAt = new Date().toISOString();
      tx.credentialsHoldUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }
    await saveTransactionState(db);
    res.json({ success: true, tx });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

async function assignEscrow(req, res) {
  try {
    const db = await loadTransactionState();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || (user.role !== 'escrow' && user.role !== 'admin')) return res.status(403).json({ success: false, error: 'Forbidden' });
    const tx = db.transactions.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ success: false, error: 'Tx not found' });
    tx.escrowId = user.id;
    await saveTransactionState(db);
    res.json({ success: true, tx });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

module.exports = { buyProduct, listTransactions, pendingTransactions, confirmTransaction, getTransaction, setTransactionStage, assignEscrow };
