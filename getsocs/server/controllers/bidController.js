const { loadBidState, saveBidState, withBidState } = require('../repositories/bidRepository');
const { getIdempotencyKey, findExisting, saveResult } = require('../middleware/idempotency');
const { validateBidAmount } = require('../utils/inputValidation');
const { invalidateProductCaches } = require('../services/productCacheService');

/**
 * Bid Controller - Handles product bidding
 */

async function placeBid(req, res) {
  try {
    const { listingId, message } = req.body;
    const bidAmount = Number(req.body?.bidAmount);
    const userId = req.user.id;

    if (!listingId || !validateBidAmount(bidAmount)) {
      return res.status(400).json({ success: false, error: 'Valid listing ID and bid amount are required' });
    }

    const result = await withBidState(async db => {
      const listing = db.products.find(p => p.id === listingId);
      const user = db.users.find(u => u.id === userId);

      if (!listing) return { statusCode: 404, body: { success: false, error: 'Listing not found' } };
      if (!user) return { statusCode: 404, body: { success: false, error: 'User not found' } };
      if (listing.status !== 'approved' || listing.hidden) {
        return { statusCode: 409, body: { success: false, error: 'Listing is not currently available for bids' } };
      }
      if (listing.sellerId === userId) {
        return { statusCode: 400, body: { success: false, error: 'Cannot bid on your own listing' } };
      }

      const askingPrice = Number(listing.price);
      if (!Number.isFinite(askingPrice) || askingPrice < 0) {
        return { statusCode: 409, body: { success: false, error: 'Listing price is invalid' } };
      }
      if (bidAmount < askingPrice * 0.8) {
        return { statusCode: 400, body: { success: false, error: 'Bid must be at least 80% of asking price' } };
      }

      const existingBid = db.bids.find(b => b.listingId === listingId && b.bidderId === userId && b.status === 'pending');
      if (existingBid) {
        return { statusCode: 409, body: { success: false, error: 'You already have a pending bid for this listing' } };
      }

      const bid = {
        id: `bid_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        listingId,
        bidderId: userId,
        bidAmount,
        status: 'pending',
        message: typeof message === 'string' ? message.slice(0, 2000) : '',
        createdAt: new Date().toISOString(),
        respondedAt: null,
        transactionId: null,
        sellerMessage: null
      };

      db.bids.push(bid);
      return { statusCode: 200, body: { success: true, bid, message: 'Bid placed successfully. Waiting for seller response.' } };
    });

    return res.status(result.statusCode).json(result.body);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

async function getListingBids(req, res) {
  try {
    const { listingId } = req.params;
    const userId = req.user.id;

    if (!listingId) {
      return res.status(400).json({ success: false, error: 'Listing ID required' });
    }

    const db = await loadBidState();
    const listing = db.products.find(p => p.id === listingId);

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    // Only seller or admin can see all bids
    if (listing.sellerId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const bids = db.bids.filter(b => b.listingId === listingId);

    const detailed = bids.map(bid => {
      const bidder = db.users.find(u => u.id === bid.bidderId);
      return {
        ...bid,
        bidderName: bidder?.username,
        bidderAvatar: bidder?.profileAvatar
      };
    });

    res.json({ 
      success: true, 
      bids: detailed,
      count: detailed.length
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getUserBids(req, res) {
  try {
    const userId = req.params.userId || req.user.id;

    const db = await loadBidState();
    const bids = db.bids.filter(b => b.bidderId === userId);

    const detailed = bids.map(bid => {
      const listing = db.products.find(p => p.id === bid.listingId);
      const seller = db.users.find(u => u.id === listing?.sellerId);
      return {
        ...bid,
        listingTitle: listing?.title,
        listingPrice: listing?.price,
        sellerName: seller?.username
      };
    });

    res.json({ 
      success: true, 
      bids: detailed,
      count: detailed.length
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function acceptBid(req, res) {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;
    const { sellerMessage } = req.body;

    if (!bidId) return res.status(400).json({ success: false, error: 'Bid ID required' });
    const idempotencyKey = getIdempotencyKey(req);
    if (idempotencyKey === false) return res.status(400).json({ success: false, error: 'Invalid Idempotency-Key format' });

    const result = await withBidState(async db => {
      if (idempotencyKey) {
        const previous = findExisting(db, idempotencyKey, req);
        if (previous?.conflict) return { statusCode: 409, body: { success: false, error: 'Idempotency-Key was already used for a different request' } };
        if (previous) return { statusCode: previous.statusCode, body: previous.body };
      }

      const bid = db.bids.find(b => b.id === bidId);
      if (!bid) return { statusCode: 404, body: { success: false, error: 'Bid not found' } };
      const listing = db.products.find(p => p.id === bid.listingId);
      if (!listing) return { statusCode: 404, body: { success: false, error: 'Listing not found' } };
      if (listing.sellerId !== userId) return { statusCode: 403, body: { success: false, error: 'Only seller can accept bid' } };
      if (bid.status !== 'pending') return { statusCode: 409, body: { success: false, error: 'Bid is no longer pending' } };
      if (listing.status !== 'approved' || listing.hidden) {
        return { statusCode: 409, body: { success: false, error: 'Listing is no longer available' }, productId: listing.id };
      }

      const active = db.transactions.find(t =>
        (t.productId === listing.id || t.listingId === listing.id) &&
        ['pending', 'escrow_active'].includes(t.status)
      );
      if (active) return { statusCode: 409, body: { success: false, error: 'Listing already has an active transaction' }, productId: listing.id };

      const now = new Date().toISOString();
      bid.status = 'accepted';
      bid.respondedAt = now;
      bid.sellerMessage = typeof sellerMessage === 'string' && sellerMessage.trim() ? sellerMessage.slice(0, 2000) : 'Accepted your bid offer';

      // Once a bid is accepted, all competing pending bids are no longer valid.
      for (const other of db.bids) {
        if (other.id !== bid.id && other.listingId === listing.id && other.status === 'pending') {
          other.status = 'rejected';
          other.respondedAt = now;
          other.sellerMessage = 'Another offer was accepted';
        }
      }

      const tx = {
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        listingId: bid.listingId,
        listingTitle: listing.title,
        listingPrice: bid.bidAmount,
        productPrice: bid.bidAmount,
        buyerId: bid.bidderId,
        buyerName: db.users.find(u => u.id === bid.bidderId)?.username,
        sellerId: listing.sellerId,
        sellerName: db.users.find(u => u.id === listing.sellerId)?.username,
        status: 'pending',
        stage: 'waiting',
        createdAt: now,
        bidId: bidId
      };

      db.transactions.push(tx);
      bid.transactionId = tx.id;
      listing.status = 'reserved';
      listing.reservedBy = tx.buyerId;
      listing.reservedTransactionId = tx.id;
      listing.reservedAt = now;

      db.chats.push({
        id: tx.id,
        txId: tx.id,
        type: 'escrow',
        participants: [tx.buyerId, tx.sellerId],
        createdAt: now,
        messages: [{
          id: `msg_${Date.now()}`,
          senderId: tx.sellerId,
          text: `Accepted your bid of $${Number(bid.bidAmount).toFixed(2)}`,
          isSystemMessage: true,
          timestamp: now
        }]
      });

      const body = { success: true, bid, transaction: tx, message: 'Bid accepted. Transaction started.' };
      if (idempotencyKey) saveResult(db, idempotencyKey, req, 200, body);
      return { statusCode: 200, body, productId: listing.id };
    });

    if (result.productId) await invalidateProductCaches(result.productId);
    return res.status(result.statusCode).json(result.body);
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
}

async function rejectBid(req, res) {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    if (!bidId) {
      return res.status(400).json({ success: false, error: 'Bid ID required' });
    }

    const db = await loadBidState();
    const bid = db.bids.find(b => b.id === bidId);

    if (!bid) {
      return res.status(404).json({ success: false, error: 'Bid not found' });
    }

    const listing = db.products.find(p => p.id === bid.listingId);

    // Only seller can reject
    if (listing.sellerId !== userId) {
      return res.status(403).json({ success: false, error: 'Only seller can reject bid' });
    }

    if (bid.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Bid is no longer pending' });
    }

    bid.status = 'rejected';
    bid.respondedAt = new Date().toISOString();
    bid.sellerMessage = reason || 'Your bid was not accepted';

    await saveBidState(db);

    res.json({ 
      success: true, 
      bid,
      message: 'Bid rejected'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function cancelBid(req, res) {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;

    if (!bidId) {
      return res.status(400).json({ success: false, error: 'Bid ID required' });
    }

    const db = await loadBidState();
    const bid = db.bids.find(b => b.id === bidId);

    if (!bid) {
      return res.status(404).json({ success: false, error: 'Bid not found' });
    }

    // Only bidder can cancel
    if (bid.bidderId !== userId) {
      return res.status(403).json({ success: false, error: 'Only bidder can cancel' });
    }

    if (bid.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Can only cancel pending bids' });
    }

    bid.status = 'cancelled';
    bid.respondedAt = new Date().toISOString();

    await saveBidState(db);

    res.json({ 
      success: true, 
      bid,
      message: 'Bid cancelled'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = {
  placeBid,
  getListingBids,
  getUserBids,
  acceptBid,
  rejectBid,
  cancelBid
};
