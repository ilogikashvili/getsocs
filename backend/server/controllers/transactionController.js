const { readDB, writeDB } = require('../config/db');
const { isUserOnline } = require('../utils/presence');

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

function buyProduct(req, res) {
  try {
    const db = readDB();
    const prod = db.products.find(p => p.id === req.params.id);
    if (!prod) return res.status(404).json({ success: false, error: 'Product not found' });
    const buyer = db.users.find(u => u.id === req.user.id);
    if (!buyer) return res.status(401).json({ success: false, error: 'Buyer missing' });
    if (prod.sellerId === buyer.id) return res.status(400).json({ success: false, error: 'Cannot buy your own product' });
    const seller = db.users.find(u => u.id === prod.sellerId);
    const existing = db.transactions.find(t => t.productId === prod.id && t.buyerId === buyer.id && t.status === 'pending');
    if (existing) return res.status(400).json({ success: false, error: 'You already have a pending purchase for this product' });
    const ALLOWED_PAYMENT_METHODS = ['card', 'paypal', 'crypto', 'bank_transfer'];
    const paymentMethod = ALLOWED_PAYMENT_METHODS.includes(req.body?.paymentMethod) ? req.body.paymentMethod : 'card';
    const serviceFeeRate = 0.06; // 6% service fee, matches the 4-8% range shown to buyers
    const serviceFee = Math.max(3, Math.round(prod.price * serviceFeeRate * 100) / 100);
    const tx = { 
      id: Date.now().toString(), 
      productId: prod.id, 
      productTitle: prod.title,
      productPrice: prod.price,
      serviceFee,
      totalPrice: Math.round((Number(prod.price) + serviceFee) * 100) / 100,
      paymentMethod,
      buyerId: buyer.id, 
      buyerName: buyer.username,
      sellerId: seller.id, 
      sellerName: seller.username,
      status: 'pending', 
      stage: 'waiting', // waiting -> fee -> channel_transfer -> payment
      createdAt: new Date().toISOString() 
    };
    db.transactions.push(tx);
    db.chats.push({ id: tx.id, txId: tx.id, messages: [] });
    writeDB(db);
    return res.json({ success: true, tx });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

function listTransactions(req, res) {
  try {
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(401).json({ success: false, error: 'User not found' });
    if (user.role === 'escrow' || user.role === 'admin') return res.json({ success: true, data: db.transactions.map(t => enrichTx(db, t)) });
    const out = db.transactions.filter(t => t.buyerId === user.id || t.sellerId === user.id).map(t => enrichTx(db, t));
    res.json({ success: true, data: out });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function pendingTransactions(req, res) {
  try {
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || (user.role !== 'escrow' && user.role !== 'admin')) return res.status(403).json({ success: false, error: 'Forbidden' });
    const pending = db.transactions.filter(t => t.status === 'pending');
    res.json({ success: true, data: pending });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function confirmTransaction(req, res) {
  try {
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || (user.role !== 'escrow' && user.role !== 'admin')) return res.status(403).json({ success: false, error: 'Forbidden' });
    const tx = db.transactions.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ success: false, error: 'Tx not found' });
    
    // Update buyer points (bought)
    const buyer = db.users.find(u => u.id === tx.buyerId);
    if (buyer) {
      buyer.pointsBought = (buyer.pointsBought || 0) + (tx.productPrice || 0);
    }
    
    // Update seller points (sold)
    const seller = db.users.find(u => u.id === tx.sellerId);
    if (seller) {
      seller.pointsSold = (seller.pointsSold || 0) + (tx.productPrice || 0);
    }
    
    tx.status = 'completed';
    tx.stage = 'payment';
    tx.completedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true, tx });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function getTransaction(req, res) {
  try {
    const db = readDB();
    const tx = db.transactions.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ success: false, error: 'Transaction not found' });
    res.json({ success: true, data: enrichTx(db, tx) });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}

function setTransactionStage(req, res) {
  try {
    const db = readDB();
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
    writeDB(db);
    res.json({ success: true, tx });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

function assignEscrow(req, res) {
  try {
    const db = readDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user || (user.role !== 'escrow' && user.role !== 'admin')) return res.status(403).json({ success: false, error: 'Forbidden' });
    const tx = db.transactions.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ success: false, error: 'Tx not found' });
    tx.escrowId = user.id;
    writeDB(db);
    res.json({ success: true, tx });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
}

module.exports = { buyProduct, listTransactions, pendingTransactions, confirmTransaction, getTransaction, setTransactionStage, assignEscrow };
