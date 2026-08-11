const { readDB, writeDB } = require('../config/db');

/**
 * Bid Controller - Handles product bidding
 */

function placeBid(req, res) {
  try {
    const { listingId, bidAmount, message } = req.body;
    const userId = req.user.id;

    if (!listingId || bidAmount === undefined) {
      return res.status(400).json({ success: false, error: 'Listing ID and bid amount required' });
    }

    const db = readDB();
    const listing = db.products.find(p => p.id === listingId);
    const user = db.users.find(u => u.id === userId);

    if (!listing) return res.status(404).json({ success: false, error: 'Listing not found' });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Can't bid on own listing
    if (listing.sellerId === userId) {
      return res.status(400).json({ success: false, error: 'Cannot bid on your own listing' });
    }

    // Bid must be at least listing price (or higher if negotiating down)
    if (bidAmount < listing.price * 0.8) {
      return res.status(400).json({ success: false, error: 'Bid must be at least 80% of asking price' });
    }

    // Check for pending bid from same user
    const existingBid = db.bids.find(b => 
      b.listingId === listingId && 
      b.bidderId === userId && 
      b.status === 'pending'
    );

    if (existingBid) {
      return res.status(400).json({ success: false, error: 'You already have a pending bid for this listing' });
    }

    const bid = {
      id: `bid_${Date.now()}`,
      listingId,
      bidderId: userId,
      bidAmount,
      status: 'pending',
      message: message || '',
      createdAt: new Date().toISOString(),
      respondedAt: null,
      transactionId: null,
      sellerMessage: null
    };

    db.bids.push(bid);
    writeDB(db);

    res.json({ 
      success: true, 
      bid,
      message: 'Bid placed successfully. Waiting for seller response.'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getListingBids(req, res) {
  try {
    const { listingId } = req.params;
    const userId = req.user.id;

    if (!listingId) {
      return res.status(400).json({ success: false, error: 'Listing ID required' });
    }

    const db = readDB();
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

function getUserBids(req, res) {
  try {
    const userId = req.params.userId || req.user.id;

    const db = readDB();
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

function acceptBid(req, res) {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;
    const { sellerMessage } = req.body;

    if (!bidId) {
      return res.status(400).json({ success: false, error: 'Bid ID required' });
    }

    const db = readDB();
    const bid = db.bids.find(b => b.id === bidId);

    if (!bid) {
      return res.status(404).json({ success: false, error: 'Bid not found' });
    }

    const listing = db.products.find(p => p.id === bid.listingId);

    // Only seller can accept
    if (listing.sellerId !== userId) {
      return res.status(403).json({ success: false, error: 'Only seller can accept bid' });
    }

    if (bid.status !== 'pending') {
      return res.status(400).json({ success: false, error: 'Bid is no longer pending' });
    }

    // Accept bid and create transaction
    bid.status = 'accepted';
    bid.respondedAt = new Date().toISOString();
    bid.sellerMessage = sellerMessage || 'Accepted your bid offer';

    const tx = {
      id: `tx_${Date.now()}`,
      listingId: bid.listingId,
      listingTitle: listing.title,
      listingPrice: bid.bidAmount, // Use bid amount, not listing price
      buyerId: bid.bidderId,
      buyerName: db.users.find(u => u.id === bid.bidderId)?.username,
      sellerId: listing.sellerId,
      sellerName: db.users.find(u => u.id === listing.sellerId)?.username,
      status: 'pending',
      createdAt: new Date().toISOString(),
      bidId: bidId
    };

    db.transactions.push(tx);
    bid.transactionId = tx.id;

    // Create associated chat
    db.chats.push({
      id: tx.id,
      txId: tx.id,
      type: 'escrow',
      participants: [tx.buyerId, tx.sellerId],
      createdAt: new Date().toISOString(),
      messages: [
        {
          id: `msg_${Date.now()}`,
          senderId: tx.sellerId,
          text: `Accepted your bid of $${bid.bidAmount.toFixed(2)}`,
          isSystemMessage: true,
          timestamp: new Date().toISOString()
        }
      ]
    });

    writeDB(db);

    res.json({ 
      success: true, 
      bid,
      transaction: tx,
      message: 'Bid accepted. Transaction started.'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function rejectBid(req, res) {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    if (!bidId) {
      return res.status(400).json({ success: false, error: 'Bid ID required' });
    }

    const db = readDB();
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

    writeDB(db);

    res.json({ 
      success: true, 
      bid,
      message: 'Bid rejected'
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function cancelBid(req, res) {
  try {
    const { bidId } = req.params;
    const userId = req.user.id;

    if (!bidId) {
      return res.status(400).json({ success: false, error: 'Bid ID required' });
    }

    const db = readDB();
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

    writeDB(db);

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
