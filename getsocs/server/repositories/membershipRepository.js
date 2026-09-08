const { loadState } = require('./stateRepository');
async function listSubscriptionDetails() {
  const db = await loadState();
  return (db.user_memberships || []).map(sub => {
    const user = (db.users || []).find(u => u.id === sub.userId);
    const tier = (db.memberships || []).find(t => t.id === sub.membershipTierId);
    return { ...sub, username: user?.username, tierName: tier?.name };
  });
}
async function getRevenueSnapshot() {
  const db = await loadState();
  const subscriptions = (db.user_memberships || []).filter(s => s.status === 'active');
  const addons = (db.user_addons || []).filter(a => a.active);
  const membershipRevenue = subscriptions.reduce((sum, sub) => {
    const tier = (db.memberships || []).find(t => t.id === sub.membershipTierId);
    return sum + (tier ? Number(tier.price) || 0 : 0);
  }, 0);
  const addonRevenue = addons.reduce((sum, purchase) => {
    const addon = (db.addons || []).find(a => a.id === purchase.addonId);
    return sum + (addon ? Number(addon.price) || 0 : 0);
  }, 0);
  return { subscriptions, addons, membershipRevenue, addonRevenue };
}
module.exports = { listSubscriptionDetails, getRevenueSnapshot };
