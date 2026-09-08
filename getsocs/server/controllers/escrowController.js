const EscrowService = require('../services/escrowService');
const { loadEscrowState, saveEscrowState } = require('../repositories/escrowRepository');
const { getIdempotencyKey, findExisting, saveResult } = require('../middleware/idempotency');

/**
 * Escrow Controller - Handles escrow operations
 */

function checkIdempotency(req, res, db) {
  const key = getIdempotencyKey(req);
  if (key === false) {
    res.status(400).json({ success: false, error: 'Invalid Idempotency-Key format' });
    return { handled: true, key: null };
  }
  if (!key) return { handled: false, key: null };
  const previous = findExisting(db, key, req);
  if (previous?.conflict) {
    res.status(409).json({ success: false, error: 'Idempotency-Key was already used for a different request' });
    return { handled: true, key };
  }
  if (previous) {
    res.status(previous.statusCode).json(previous.body);
    return { handled: true, key };
  }
  return { handled: false, key };
}

async function persistIdempotentResult(req, key, statusCode, body) {
  if (!key) return;
  const latest = await loadEscrowState();
  saveResult(latest, key, req, statusCode, body);
  await saveEscrowState(latest);
}

async function initiateEscrow(req, res) {
  try {
    const { transactionId, buyerConfirmed, sellerConfirmed } = req.body;
    const userId = req.user.id;

    if (!transactionId) return res.status(400).json({ success: false, error: 'Transaction ID required' });

    const db = await loadEscrowState();
    const idempotency = checkIdempotency(req, res, db);
    if (idempotency.handled) return;
    const tx = db.transactions.find(t => t.id === transactionId);

    if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });
    if (userId !== tx.buyerId && userId !== tx.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }
    if (!buyerConfirmed || !sellerConfirmed) {
      return res.status(400).json({ success: false, error: 'Both buyer and seller must confirm' });
    }

    const escrow = await EscrowService.startEscrow(transactionId, true, true);
    const body = { success: true, escrow, message: 'Escrow started successfully' };
    persistIdempotentResult(req, idempotency.key, 200, body);
    res.json(body);
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

async function getEscrowStatus(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const db = await loadEscrowState();
    const tx = db.transactions.find(t => t.id === transactionId);

    // Verify access
    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (userId !== tx.buyerId && userId !== tx.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const status = await EscrowService.getEscrowStatus(transactionId);

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

async function extendEscrow(req, res) {
  try {
    const { transactionId } = req.params;
    const { hours } = req.body;
    const userId = req.user.id;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const db = await loadEscrowState();
    const tx = db.transactions.find(t => t.id === transactionId);

    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (userId !== tx.buyerId && userId !== tx.sellerId && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const extensionHours = Number(hours) || 24;
    const escrow = await EscrowService.extendEscrow(transactionId, extensionHours);

    res.json({
      success: true,
      escrow,
      message: `Escrow extended by ${extensionHours} hours`
    });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

async function buyerReleaseFunds(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const db = await loadEscrowState();
    const idempotency = checkIdempotency(req, res, db);
    if (idempotency.handled) return;
    const tx = db.transactions.find(t => t.id === transactionId);

    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (userId !== tx.buyerId) {
      return res.status(403).json({ success: false, error: 'Only buyer can release funds' });
    }

    const escrow = await EscrowService.buyerReleaseFunds(transactionId);

    const body = { success: true, escrow, message: 'Buyer confirmed fund release' };
    persistIdempotentResult(req, idempotency.key, 200, body);
    res.json(body);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

async function sellerReleaseFunds(req, res) {
  try {
    const { transactionId } = req.params;
    const userId = req.user.id;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const db = await loadEscrowState();
    const idempotency = checkIdempotency(req, res, db);
    if (idempotency.handled) return;
    const tx = db.transactions.find(t => t.id === transactionId);

    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    if (userId !== tx.sellerId) {
      return res.status(403).json({ success: false, error: 'Only seller can release funds' });
    }

    const escrow = await EscrowService.sellerReleaseFunds(transactionId);

    const body = { success: true, escrow, message: 'Seller confirmed transaction completion' };
    persistIdempotentResult(req, idempotency.key, 200, body);
    res.json(body);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

async function disputeEscrow(req, res) {
  try {
    const { transactionId } = req.params;
    const { reason } = req.body;
    const userId = req.user.id;

    if (!transactionId || !reason) {
      return res.status(400).json({ success: false, error: 'Transaction ID and reason required' });
    }

    const db = await loadEscrowState();
    const tx = db.transactions.find(t => t.id === transactionId);

    if (!tx) {
      return res.status(404).json({ success: false, error: 'Transaction not found' });
    }

    // Only buyer or seller can dispute
    if (userId !== tx.buyerId && userId !== tx.sellerId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const escrow = await EscrowService.disputeEscrow(transactionId, reason);

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

async function adminCompleteEscrow(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const idempotencyDb = await loadEscrowState();
    const idempotency = checkIdempotency(req, res, idempotencyDb);
    if (idempotency.handled) return;

    const { transactionId } = req.params;
    const { adminNotes } = req.body;

    if (!transactionId) {
      return res.status(400).json({ success: false, error: 'Transaction ID required' });
    }

    const result = await EscrowService.adminCompleteEscrow(transactionId, adminNotes || '');

    const body = { success: true, result, message: 'Escrow completed by admin' };
    persistIdempotentResult(req, idempotency.key, 200, body);
    res.json(body);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

async function adminRefundEscrow(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const idempotencyDb = await loadEscrowState();
    const idempotency = checkIdempotency(req, res, idempotencyDb);
    if (idempotency.handled) return;

    const { transactionId } = req.params;
    const { reason } = req.body;

    if (!transactionId || !reason) {
      return res.status(400).json({ success: false, error: 'Transaction ID and reason required' });
    }

    const result = await EscrowService.refundEscrow(transactionId, reason);

    const body = { success: true, result, message: 'Transaction refunded' };
    persistIdempotentResult(req, idempotency.key, 200, body);
    res.json(body);
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
}

async function adminViewDisputes(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const db = await loadEscrowState();
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

async function adminGetAllEscrows(req, res) {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Admin only' });
    }

    const { status } = req.query;
    const db = await loadEscrowState();
    let escrows = db.escrow;

    if (status) {
      escrows = escrows.filter(e => e.status === status);
    }

    const detailed = await Promise.all(escrows.map(async escrow => {
      const tx = db.transactions.find(t => t.id === escrow.transactionId);
      const remaining = await EscrowService.getRemainingTime(escrow.transactionId);
      return {
        ...escrow,
        transaction: tx,
        timeRemaining: remaining,
        timeFormatted: EscrowService.formatTimeRemaining(remaining || 0)
      };
    }));

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
