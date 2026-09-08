const { readNotificationContext, updateNotifications } = require('../repositories/notificationRepository');

async function getNotifications(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'No token' });
    const context = await readNotificationContext(userId);
    const userNotifications = context.stored;

    if (userNotifications.length > 0) {
      return res.json({ success: true, data: userNotifications });
    }

    const transactions = context.transactions;
    const myTransactions = transactions.filter(tx => tx.buyerId === userId || tx.sellerId === userId).slice(0, 3);
    const products = context.products;
    const recentProducts = products.filter(product => product.status === 'approved' && !product.hidden).slice(0, 3);

    const generated = [];
    if (myTransactions.length) {
      myTransactions.forEach(tx => {
        generated.push({
          id: `tx-${tx.id}`,
          userId,
          title: tx.status === 'completed' ? 'Order completed' : 'Order update',
          text: `${tx.productTitle || 'Listing'} is ${tx.status || 'pending'}.`,
          time: tx.completedAt || tx.createdAt || new Date().toISOString(),
          category: 'orders',
          unread: true,
          tone: 'blue',
          icon: 'bell'
        });
      });
    }

    if (recentProducts.length) {
      recentProducts.forEach(product => {
        generated.push({
          id: `product-${product.id}`,
          userId,
          title: 'New listing available',
          text: `${product.title} is now live on the marketplace.`,
          time: product.createdAt || new Date().toISOString(),
          category: 'market',
          unread: true,
          tone: 'green',
          icon: 'shield'
        });
      });
    }

    if (!generated.length) {
      generated.push({
        id: `welcome-${userId}`,
        userId,
        title: 'Welcome to Getsocs',
        text: 'Your activity will appear here as you interact with listings.',
        time: new Date().toISOString(),
        category: 'system',
        unread: true,
        tone: 'violet',
        icon: 'bell'
      });
    }

    return res.json({ success: true, data: generated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = { getNotifications, markAllRead, markNotificationRead };

function generateNotificationsForUser(db, userId) {
  const transactions = Array.isArray(db.transactions) ? db.transactions : [];
  const myTransactions = transactions.filter(tx => tx.buyerId === userId || tx.sellerId === userId).slice(0, 3);
  const products = Array.isArray(db.products) ? db.products : [];
  const recentProducts = products.filter(product => product.status === 'approved' && !product.hidden).slice(0, 3);

  const generated = [];
  if (myTransactions.length) {
    myTransactions.forEach(tx => {
      generated.push({
        id: `tx-${tx.id}`,
        userId,
        title: tx.status === 'completed' ? 'Order completed' : 'Order update',
        text: `${tx.productTitle || 'Listing'} is ${tx.status || 'pending'}.`,
        time: tx.completedAt || tx.createdAt || new Date().toISOString(),
        category: 'orders',
        unread: true,
        tone: 'blue',
        icon: 'bell'
      });
    });
  }

  if (recentProducts.length) {
    recentProducts.forEach(product => {
      generated.push({
        id: `product-${product.id}`,
        userId,
        title: 'New listing available',
        text: `${product.title} is now live on the marketplace.`,
        time: product.createdAt || new Date().toISOString(),
        category: 'market',
        unread: true,
        tone: 'green',
        icon: 'shield'
      });
    });
  }

  if (!generated.length) {
    generated.push({
      id: `welcome-${userId}`,
      userId,
      title: 'Welcome to Getsocs',
      text: 'Your activity will appear here as you interact with listings.',
      time: new Date().toISOString(),
      category: 'system',
      unread: true,
      tone: 'violet',
      icon: 'bell'
    });
  }

  return generated;
}

async function markAllRead(req, res) {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ success: false, error: 'No token' });
    await updateNotifications(db => {
      const generated = generateNotificationsForUser(db, userId);
      const byId = {};
      db.notifications.forEach(n => { if (n.userId === userId) byId[n.id] = n; });
      generated.forEach(n => { byId[n.id] = { ...n, unread: false }; });
      const others = db.notifications.filter(n => n.userId !== userId);
      db.notifications = others.concat(Object.values(byId));
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}

async function markNotificationRead(req, res) {
  try {
    const userId = req.user?.id;
    const id = req.params.id;
    if (!userId) return res.status(401).json({ success: false, error: 'No token' });
    let found = false;
    await updateNotifications(db => {
      db.notifications = db.notifications.map(n => {
        if (n.id === id && (!n.userId || n.userId === userId)) {
          found = true;
          return { ...n, unread: false };
        }
        return n;
      });
      if (!found) {
        const generated = generateNotificationsForUser(db, userId);
        const match = generated.find(n => n.id === id);
        if (match) { db.notifications.push({ ...match, unread: false }); found = true; }
      }
    });
    return res.json({ success: true, found });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}