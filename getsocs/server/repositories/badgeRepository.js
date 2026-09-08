const { loadState, saveState, withLockedState } = require('./stateRepository');
const { USE_TEST_FILE_DB, getMysqlPool } = require('../config/db');
const metrics = require('../services/metricsService');
function parsePayload(value){ if(value && typeof value==='object' && !Buffer.isBuffer(value)) return value; try{return JSON.parse(Buffer.isBuffer(value)?value.toString('utf8'):String(value));}catch(_){return{};} }
async function loadBadgeState() { return loadState(); }
async function saveBadgeState(state) { return saveState(state); }
async function withBadgeState(mutator) { return withLockedState(mutator); }
async function listAllBadges() {
  if (USE_TEST_FILE_DB) return (await loadState()).badges || [];
  const started=Date.now();
  try { const [rows]=await getMysqlPool().query('SELECT payload FROM badges ORDER BY id'); metrics.observeDatabase('badges.catalog',Date.now()-started,true); return rows.map(r=>parsePayload(r.payload)); }
  catch(error){ metrics.observeDatabase('badges.catalog',Date.now()-started,false); throw error; }
}
module.exports = { loadBadgeState, saveBadgeState, withBadgeState, listAllBadges };
