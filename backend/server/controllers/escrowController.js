const EscrowService = require('../services/escrowService');
const { readDB, writeDB } = require('../config/db');

/**
 * Escrow Controller - Handles escrow operations
 */

function initiateEscrow(req, res) {
  try {
    const { transactionId, buyerConfirmed, sellerConfirmed } = req.body;
    const userId = req.user.id;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const db = readDB();
    const tx = db.transactions.find(t => t.id === transactionId);

    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Only buyer, seller, or admin can initiate
    if (userId !== tx.buyerId && userId !== tx.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Both parties must confirm
    if (!buyerConfirmed || !sellerConfirmed) {
      return res.status(400).json({ 
        success: false, 
        error: 'Both buyer and seller must confirm' 
      });
    }

    const escrow = EscrowService.startEscrow(transactionId, true, true);

    res.json({ 
      success: true, 
      escrow,
      message: 'Escrow started successfully' 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getEscrowStatus(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const db = readDB();
    const tx = db.transactions.find(t => t.id === transactionId);

    // Verify access
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (userId !== tx.buyerId && userId !== tx.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const status = EscrowService.getEscrowStatus(transactionId);

    if (!status) {
      return res.status(404).json({ success: false, error: 'Escrow not found or not active' });
    }

    res.json({ success: true, escrow: status });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getEscrowTimer(req, res) {
  try {
    return getEscrowStatus(req, res);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function extendEscrow(req, res) {
  try {
    const { transactionId } = req.params;
    const { hours } = req.body;
    const userId = req.user.id;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const db = readDB();
    const tx = db.transactions.find(t => t.id === transactionId);

    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (userId !== tx.buyerId && userId !== tx.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const extensionHours = Number(hours) || 24;
    const escrow = EscrowService.extendEscrow(transactionId, extensionHours);

    res.json({
      success: true,
      escrow,
      message: `Escrow extended by ${extensionHours} hours`
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

function buyerReleaseFunds(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const db = readDB();
    const tx = db.transactions.find(t => t.id === transactionId);

    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (userId !== tx.buyerId) {
      return res.status(403).json({ success: false, error: 'Only buyer can release funds' });
    }

    const escrow = EscrowService.buyerReleaseFunds(transactionId);

    res.json({ 
      success: true, 
      escrow,
      message: 'Buyer confirmed fund release' 
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

function sellerReleaseFunds(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const db = readDB();
    const tx = db.transactions.find(t => t.id === transactionId);

    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (userId !== tx.sellerId) {
      return res.status(403).json({ success: false, error: 'Only seller can release funds' });
    }

    const escrow = EscrowService.sellerReleaseFunds(transactionId);

    res.json({ 
      success: true, 
      escrow,
      message: 'Seller confirmed transaction completion' 
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

function disputeEscrow(req, res) {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!transactionId || !reason) {
      return res.status(400).json({ success: false, error: 'Transaction ID and reason required' });
    }

    const db = readDB();
    const tx = db.transactions.find(t => t.id === transactionId);

    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Only buyer or seller can dispute
    if (userId !== tx.buyerId && userId !== tx.sellerId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const escrow = EscrowService.disputeEscrow(transactionId, reason);

    res.json({ 
      success: true, 
      escrow,
      message: 'Dispute filed - admin will review' 
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

// ADMIN ONLY

function adminCompleteEscrow(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { transactionId } = req.params;
    const { adminNotes } = req.body;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const result = EscrowService.adminCompleteEscrow(transactionId, adminNotes || '');

    res.json({ 
      success: true, 
      result,
      message: 'Escrow completed by admin' 
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

function adminRefundEscrow(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { transactionId } = req.params;
    const { reason } = req.body;

    if (!transactionId || !reason) {
      return res.status(400).json({ success: false, error: 'Transaction ID and reason required' });
    }

    const result = EscrowService.refundEscrow(transactionId, reason);

    res.json({ 
      success: true, 
      result,
      message: 'Transaction refunded' 
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

function adminViewDisputes(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const db = readDB();
    const disputes = db.escrow.filter(e => e.status === 'disputed');

    const disputeDetails = disputes.map(escrow => {
      const tx = db.transactions.find(t => t.id === escrow.transactionId);
      return {
        ...escrow,
        transaction: tx
      };
    });

    res.json({ 
      success: true, 
      disputes: disputeDetails,
      count: disputeDetails.length 
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function adminGetAllEscrows(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { status } = req.query;
    const db = readDB();
    let escrows = db.escrow;

    if (status) {
      escrows = escrows.filter(e => e.status === status);
    }

    const detailed = escrows.map(escrow => {
      const tx = db.transactions.find(t => t.id === escrow.transactionId);
      const remaining = EscrowService.getRemainingTime(escrow.transactionId);
      return {
        ...escrow,
        transaction: tx,
        timeRemaining: remaining,
        timeFormatted: EscrowService.formatTimeRemaining(remaining || 0)
      };
    });

    res.json({ 
      success: true, 
      escrows: detailed,
      count: detailed.length,
      byStatus: {
        active: detailed.filter(e => e.status === 'active').length,
        completed: detailed.filter(e => e.status === 'completed').length,
        disputed: detailed.filter(e => e.status === 'disputed').length,
        refunded: detailed.filter(e => e.status === 'refunded').length
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

module.exports = {
  initiateEscrow,
  getEscrowStatus,
  getEscrowTimer,
  extendEscrow,
  buyerReleaseFunds,
  sellerReleaseFunds,
  disputeEscrow,
  adminCompleteEscrow,
  adminRefundEscrow,
  adminViewDisputes,
  adminGetAllEscrows
};
