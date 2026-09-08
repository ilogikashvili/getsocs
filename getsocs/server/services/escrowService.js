const { loadEscrowState, saveEscrowState, withEscrowState } = require('../repositories/escrowRepository');
const { invalidateProductCaches } = require('./productCacheService');
const logger = require('../utils/logger');

/**
 * Escrow Service - Core escrow logic
 * Handles escrow initiation, timer management, and completion
 */

class EscrowService {
  /**
   * Start escrow for a transaction
   * Both buyer and seller must confirm first
   */
  static async startEscrow(transactionId, buyerConfirmed = false, sellerConfirmed = false) {
    try {
      const db = await loadEscrowState();
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

      await saveEscrowState(db);
      return escrow;
    } catch (e) {
      throw new Error(`Escrow start failed: ${e.message}`);
    }
  }

  /**
   * Get remaining time for escrow in seconds
   */
  static async getRemainingTime(transactionId) {
    try {
      const db = await loadEscrowState();
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

  static async extendEscrow(transactionId, hours = 24) {
    try {
      if (!Number.isFinite(hours) || hours <= 0) {
        throw new Error('Invalid extension hours');
      }

      const db = await loadEscrowState();
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

      await saveEscrowState(db);
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
  static async getEscrowStatus(transactionId) {
    try {
      const db = await loadEscrowState();
      const escrow = db.escrow.find(e => e.transactionId === transactionId);
      const tx = db.transactions.find(t => t.id === transactionId);

      if (!escrow || !tx) {
        return null;
      }

      const remainingSeconds = await this.getRemainingTime(transactionId);
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
  static async buyerReleaseFunds(transactionId) {
    try {
      const db = await loadEscrowState();
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

      await saveEscrowState(db);
      return escrow;
    } catch (e) {
      throw new Error(`Buyer release failed: ${e.message}`);
    }
  }

  /**
   * Allow seller to release funds early
   */
  static async sellerReleaseFunds(transactionId) {
    try {
      const db = await loadEscrowState();
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

      await saveEscrowState(db);
      return escrow;
    } catch (e) {
      throw new Error(`Seller release failed: ${e.message}`);
    }
  }

  /**
   * Complete escrow and mark transaction as completed
   */
  static async completeEscrow(transactionId, options = {}) {
    try {
      const result = await withEscrowState(async db => {
        const escrow = db.escrow.find(e => e.transactionId === transactionId);
        const tx = db.transactions.find(t => t.id === transactionId);
        if (!escrow || !tx) throw new Error('Escrow or transaction not found');

        // Idempotent completion: repeated timers/admin clicks must not award
        // points more than once or mutate the sale again.
        if (escrow.status === 'completed' || tx.status === 'completed') {
          return { escrow, transaction: tx, completedAt: tx.completedAt || escrow.autoCompletedAt, productId: tx.productId || tx.listingId, alreadyCompleted: true };
        }
        if (escrow.status === 'refunded' || tx.status === 'refunded') throw new Error('Refunded escrow cannot be completed');
        if (escrow.status === 'disputed' && !options.force) throw new Error('Disputed escrow requires an explicit admin override');

        const now = new Date().toISOString();
        escrow.status = 'completed';
        escrow.autoCompletedAt = now;
        if (typeof options.adminNotes === 'string' && options.adminNotes.trim()) escrow.adminNotes = options.adminNotes.slice(0, 4000);

        tx.status = 'completed';
        tx.stage = 'payment';
        tx.completedAt = now;

        const amount = Number(tx.amount ?? tx.productPrice ?? tx.listingPrice ?? 0);
        const seller = db.users.find(u => u.id === tx.sellerId);
        const buyer = db.users.find(u => u.id === tx.buyerId);
        if (seller && Number.isFinite(amount)) seller.pointsSold = (seller.pointsSold || 0) + amount;
        if (buyer && Number.isFinite(amount)) buyer.pointsBought = (buyer.pointsBought || 0) + amount;

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

        return { escrow, transaction: tx, completedAt: now, productId, alreadyCompleted: false };
      });

      if (result.productId) await invalidateProductCaches(result.productId);
      return result;
    } catch (e) {
      throw new Error(`Escrow completion failed: ${e.message}`);
    }
  }

  /**
   * Admin override to complete escrow
   */
  static async adminCompleteEscrow(transactionId, adminNotes = '') {
    try {
      return await this.completeEscrow(transactionId, { force: true, adminNotes });
    } catch (e) {
      throw new Error(`Admin complete failed: ${e.message}`);
    }
  }

  /**
   * Check for expired escrows and auto-complete them
   */
  static async checkAndCompleteExpiredEscrows() {
    try {
      const db = await loadEscrowState();
      const now = new Date();
      const expiredIds = db.escrow
        .filter(escrow => escrow.status === 'active' && now >= new Date(escrow.endsAt))
        .map(escrow => escrow.transactionId);

      let completed = 0;
      for (const transactionId of expiredIds) {
        try {
          const result = await this.completeEscrow(transactionId);
          if (!result.alreadyCompleted) completed += 1;
        } catch (error) {
          logger.error('Failed to auto-complete expired escrow', { transactionId, error: error.message });
        }
      }

      if (completed > 0) logger.info('Expired escrows auto-completed', { completed });
      return completed;
    } catch (e) {
      logger.error('Error checking expired escrows', { error: e.message });
      return 0;
    }
  }

  /**
   * Dispute an escrow (admin review needed)
   */
  static async disputeEscrow(transactionId, reason) {
    try {
      const db = await loadEscrowState();
      const escrow = db.escrow.find(e => e.transactionId === transactionId);

      if (!escrow) {
        throw new Error('Escrow not found');
      }

      escrow.status = 'disputed';
      escrow.adminNotes = `DISPUTE: ${reason}`;

      await saveEscrowState(db);
      return escrow;
    } catch (e) {
      throw new Error(`Dispute failed: ${e.message}`);
    }
  }

  /**
   * Refund escrow (admin only)
   */
  static async refundEscrow(transactionId, reason) {
    try {
      const result = await withEscrowState(async db => {
        const escrow = db.escrow.find(e => e.transactionId === transactionId);
        const tx = db.transactions.find(t => t.id === transactionId);
        if (!escrow || !tx) throw new Error('Escrow or transaction not found');
        if (escrow.status === 'completed' || tx.status === 'completed') throw new Error('Completed escrow cannot be refunded through this operation');
        if (escrow.status === 'refunded' || tx.status === 'refunded') {
          return { escrow, transaction: tx, productId: tx.productId || tx.listingId, alreadyRefunded: true };
        }

        const now = new Date().toISOString();
        escrow.status = 'refunded';
        escrow.adminNotes = `REFUNDED: ${String(reason || 'No reason provided').slice(0, 3900)}`;
        tx.status = 'refunded';
        tx.refundedAt = now;

        const productId = tx.productId || tx.listingId;
        const product = db.products.find(p => p.id === productId);
        if (product && product.status === 'reserved' && (!product.reservedTransactionId || product.reservedTransactionId === tx.id)) {
          product.status = 'approved';
          delete product.reservedBy;
          delete product.reservedAt;
          delete product.reservedTransactionId;
        }

        return { escrow, transaction: tx, productId, alreadyRefunded: false };
      });
      if (result.productId) await invalidateProductCaches(result.productId);
      return result;
    } catch (e) {
      throw new Error(`Refund failed: ${e.message}`);
    }
  }
}

module.exports = EscrowService;
