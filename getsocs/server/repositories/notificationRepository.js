const { loadState, saveState } = require('./stateRepository');
async function readNotificationContext(userId) {
  const db = await loadState();
  return {
    stored: (Array.isArray(db.notifications) ? db.notifications : []).filter(n => !n.userId || n.userId === userId),
    transactions: Array.isArray(db.transactions) ? db.transactions : [],
    products: Array.isArray(db.products) ? db.products : [],
  };
}
async function updateNotifications(mutator) {
  const db = await loadState();
  db.notifications = Array.isArray(db.notifications) ? db.notifications : [];
  const result = await mutator(db);
  await saveState(db);
  return result;
}
module.exports = { readNotificationContext, updateNotifications };
