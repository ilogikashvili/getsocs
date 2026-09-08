const { readDB, writeDB } = require('../config/db');

/**
 * Escrow Service - Core escrow logic
 * Handles escrow initiation, timer management, and completion
 */

class EscrowService {
  /**
   * Start escrow for a transaction
   * Both buyer and seller must confirm first
   */
  static startEscrow(transactionId, buyerConfirmed = false, sellerConfirmed = false) {
    try {
      const db = readDB();
      const tx = db.transactions.find(t => t.id === transactionId);
      
      if (!tx) {
        throw new Error('Transaction not found');
      }

      // Check if escrow already exists
      const existing = db.escrow.find(e => e.transactionId === transactionId);
      if (existing) {
        throw new Error('Escrow already exists for this transaction');
      }

      // Both parties must confirm
      if (!buyerConfirmed || !sellerConfirmed) {
        throw new Error('Both buyer and seller must confirm');
      }

      // 7 days in milliseconds
      const ESCROW_DURATION = 7 * 24 * 60 * 60 * 1000;
      const now = new Date();
      const endsAt = new Date(now.getTime() + ESCROW_DURATION);

      const escrow = {
        id: `escrow_${Date.now()}`,
        transactionId,
        status: 'active',
        startedAt: now.toISOString(),
        endsAt: endsAt.toISOString(),
        durationSeconds: 7 * 24 * 60 * 60, // 604800
        buyerConfirmed: true,
        sellerConfirmed: true,
        buyerCanRelease: false,
        sellerCanRelease: false,
        adminNotes: null,
        autoCompletedAt: null
      };

      db.escrow.push(escrow);
      
      // Update transaction status
      tx.status = 'escrow_active';
      tx.escrowStartedAt = now.toISOString();
      tx.escrowEndsAt = endsAt.toISOString();

      writeDB(db);
      return escrow;
    } catch (e) {
      throw new Error(`Escrow start failed: ${e.message}`);
    }
  }

  /**
   * Get remaining time for escrow in seconds
   */
  static getRemainingTime(transactionId) {
    try {
      const db = readDB();
      const escrow = (db.escrow || []).find(e => e.transactionId === transactionId);

      if (!escrow) {
        return null;
      }

      const now = new Date();
      const endsAt = new Date(escrow.endsAt);
      const remaining = Math.max(0, Math.floor((endsAt - now) / 1000));

      return remaining;
    } catch (e) {
      console.error('Error calculating remaining time:', e.message);
      return null;
    }
  }

  static extendEscrow(transactionId, hours = 24) {
    try {
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new Error('Invalid extension hours');
      }

      const db = readDB();
      const escrow = (db.escrow || []).find(e => e.transactionId === transactionId);
      if (!escrow) {
        throw new Error('Escrow not found');
      }
      if (escrow.status !== 'active') {
        throw new Error('Only active escrow can be extended');
      }

      const endsAt = new Date(escrow.endsAt);
      endsAt.setHours(endsAt.getHours() + hours);
      escrow.endsAt = endsAt.toISOString();
      escrow.durationSeconds = (escrow.durationSeconds || 0) + hours * 3600;

      writeDB(db);
      return escrow;
    } catch (e) {
      throw new Error(`Escrow extension failed: ${e.message}`);
    }
  }

  /**
   * Format seconds to DD:HH:MM:SS
   */
  static formatTimeRemaining(seconds) {
    if (seconds <= 0) return '00:00:00:00';

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${String(days).padStart(2, '0')}:${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  /**
   * Get full escrow status including formatted time
   */
  static getEscrowStatus(transactionId) {
    try {
      const db = readDB();
      const escrow = db.escrow.find(e => e.transactionId === transactionId);
      const tx = db.transactions.find(t => t.id === transactionId);

      if (!escrow || !tx) {
        return null;
      }

      const remainingSeconds = this.getRemainingTime(transactionId);
      const formattedTime = this.formatTimeRemaining(remainingSeconds || 0);

      return {
        id: escrow.id,
        transactionId,
        status: escrow.status,
        startedAt: escrow.startedAt,
        endsAt: escrow.endsAt,
        timeRemaining: remainingSeconds,
        timeFormattedDDHHMMSS: formattedTime,
        buyerConfirmed: escrow.buyerConfirmed,
        sellerConfirmed: escrow.sellerConfirmed,
        buyerCanRelease: escrow.buyerCanRelease,
        sellerCanRelease: escrow.sellerCanRelease,
        transactionStatus: tx.status,
        buyerName: tx.buyerName,
        sellerName: tx.sellerName,
        amount: tx.amount || tx.productPrice
      };
    } catch (e) {
      console.error('Error getting escrow status:', e.message);
      return null;
    }
  }

  /**
   * Allow buyer to release funds early
   */
  static buyerReleaseFunds(transactionId) {
    try {
      const db = readDB();
      const escrow = db.escrow.find(e => e.transactionId === transactionId);
      const tx = db.transactions.find(t => t.id === transactionId);

      if (!escrow || !tx) {
        throw new Error('Escrow or transaction not found');
      }

      if (escrow.status !== 'active') {
        throw new Error('Escrow is not active');
      }

      escrow.buyerCanRelease = true;

      // If seller already agreed or auto-complete, complete transaction
      if (escrow.sellerCanRelease) {
        return this.completeEscrow(transactionId);
      }

      writeDB(db);
      return escrow;
    } catch (e) {
      throw new Error(`Buyer release failed: ${e.message}`);
    }
  }

  /**
   * Allow seller to release funds early
   */
  static sellerReleaseFunds(transactionId) {
    try {
      const db = readDB();
      const escrow = db.escrow.find(e => e.transactionId === transactionId);
      const tx = db.transactions.find(t => t.id === transactionId);

      if (!escrow || !tx) {
        throw new Error('Escrow or transaction not found');
      }

      if (escrow.status !== 'active') {
        throw new Error('Escrow is not active');
      }

      escrow.sellerCanRelease = true;

      // If buyer already agreed, complete transaction
      if (escrow.buyerCanRelease) {
        return this.completeEscrow(transactionId);
      }

      writeDB(db);
      return escrow;
    } catch (e) {
      throw new Error(`Seller release failed: ${e.message}`);
    }
  }

  /**
   * Complete escrow and mark transaction as completed
   */
  static completeEscrow(transactionId) {
    try {
      const db = readDB();
      const escrow = db.escrow.find(e => e.transactionId === transactionId);
      const tx = db.transactions.find(t => t.id === transactionId);

      if (!escrow || !tx) {
        throw new Error('Escrow or transaction not found');
      }

      const now = new Date();

      escrow.status = 'completed';
      escrow.autoCompletedAt = now.toISOString();

      tx.status = 'completed';
      tx.completedAt = now.toISOString();

      // Update user statistics
      const seller = db.users.find(u => u.id === tx.sellerId);
      const buyer = db.users.find(u => u.id === tx.buyerId);

      if (seller) {
        seller.pointsSold = (seller.pointsSold || 0) + (tx.amount || tx.productPrice);
      }

      if (buyer) {
        buyer.pointsBought = (buyer.pointsBought || 0) + (tx.amount || tx.productPrice);
      }

      writeDB(db);
      return {
        escrow,
        transaction: tx,
        completedAt: now.toISOString()
      };
    } catch (e) {
      throw new Error(`Escrow completion failed: ${e.message}`);
    }
  }

  /**
   * Admin override to complete escrow
   */
  static adminCompleteEscrow(transactionId, adminNotes = '') {
    try {
      const db = readDB();
      const escrow = db.escrow.find(e => e.transactionId === transactionId);

      if (!escrow) {
        throw new Error('Escrow not found');
      }

      escrow.adminNotes = adminNotes;
      const result = this.completeEscrow(transactionId);
      
      return result;
    } catch (e) {
      throw new Error(`Admin complete failed: ${e.message}`);
    }
  }

  /**
   * Check for expired escrows and auto-complete them
   */
  static checkAndCompleteExpiredEscrows() {
    try {
      const db = readDB();
      const now = new Date();
      let completed = 0;

      db.escrow.forEach(escrow => {
        if (escrow.status === 'active') {
          const endsAt = new Date(escrow.endsAt);
          if (now >= endsAt) {
            const tx = db.transactions.find(t => t.id === escrow.transactionId);
            if (tx) {
              this.completeEscrow(escrow.transactionId);
              completed++;
            }
          }
        }
      });

      if (completed > 0) {
        console.log(`Auto-completed ${completed} expired escrows`);
      }

      return completed;
    } catch (e) {
      console.error('Error checking expired escrows:', e.message);
      return 0;
    }
  }

  /**
   * Dispute an escrow (admin review needed)
   */
  static disputeEscrow(transactionId, reason) {
    try {
      const db = readDB();
      const escrow = db.escrow.find(e => e.transactionId === transactionId);

      if (!escrow) {
        throw new Error('Escrow not found');
      }

      escrow.status = 'disputed';
      escrow.adminNotes = `DISPUTE: ${reason}`;

      writeDB(db);
      return escrow;
    } catch (e) {
      throw new Error(`Dispute failed: ${e.message}`);
    }
  }

  /**
   * Refund escrow (admin only)
   */
  static refundEscrow(transactionId, reason) {
    try {
      const db = readDB();
      const escrow = db.escrow.find(e => e.transactionId === transactionId);
      const tx = db.transactions.find(t => t.id === transactionId);

      if (!escrow || !tx) {
        throw new Error('Escrow or transaction not found');
      }

      escrow.status = 'refunded';
      escrow.adminNotes = `REFUNDED: ${reason}`;

      tx.status = 'refunded';
      tx.refundedAt = new Date().toISOString();

      writeDB(db);
      return { escrow, transaction: tx };
    } catch (e) {
      throw new Error(`Refund failed: ${e.message}`);
    }
  }
}

module.exports = EscrowService;
