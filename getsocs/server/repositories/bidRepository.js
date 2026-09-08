const { loadState, saveState, withLockedState } = require('./stateRepository');
async function loadBidState() { return loadState(); }
async function saveBidState(state) { return saveState(state); }
async function withBidState(mutator) { return withLockedState(mutator); }
module.exports = { loadBidState, saveBidState, withBidState };
