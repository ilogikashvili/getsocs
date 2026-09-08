const { loadState, saveState, withLockedState } = require('./stateRepository');
const { USE_TEST_FILE_DB, getMysqlPool } = require('../config/db');
const metrics = require('../services/metricsService');
function parsePayload(value){ if(value && typeof value==='object' && !Buffer.isBuffer(value)) return value; try{return JSON.parse(Buffer.isBuffer(value)?value.toString('utf8'):String(value));}catch(_){return{};} }
async function loadMembershipState() { return loadState(); }
async function saveMembershipState(state) { return saveState(state); }
async function withMembershipState(mutator) { return withLockedState(mutator); }
async function listMembershipTiers() {
  if (USE_TEST_FILE_DB) return (await loadState()).memberships || [];
  const started=Date.now(); try { const [rows]=await getMysqlPool().query('SELECT payload FROM memberships ORDER BY price ASC,id ASC'); metrics.observeDatabase('membership.tiers',Date.now()-started,true); return rows.map(r=>parsePayload(r.payload)); }
  catch(error){metrics.observeDatabase('membership.tiers',Date.now()-started,false);throw error;}
}
async function listAddons() {
  if (USE_TEST_FILE_DB) return (await loadState()).addons || [];
  const started=Date.now(); try { const [rows]=await getMysqlPool().query('SELECT payload FROM addons ORDER BY price ASC,id ASC'); metrics.observeDatabase('membership.addons',Date.now()-started,true); return rows.map(r=>parsePayload(r.payload)); }
  catch(error){metrics.observeDatabase('membership.addons',Date.now()-started,false);throw error;}
}
module.exports = { loadMembershipState, saveMembershipState, withMembershipState, listMembershipTiers, listAddons };
