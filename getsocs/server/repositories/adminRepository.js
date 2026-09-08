const { loadState, saveState, withLockedState } = require('./stateRepository');
async function loadAdminState() { return loadState(); }
async function saveAdminState(state) { return saveState(state); }
async function withAdminState(mutator) { return withLockedState(mutator); }
module.exports = { loadAdminState, saveAdminState, withAdminState };
