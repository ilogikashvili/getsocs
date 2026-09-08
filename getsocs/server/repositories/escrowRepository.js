const { loadState, saveState, withLockedState } = require('./stateRepository');
async function loadEscrowState() { return loadState(); }
async function saveEscrowState(state) { return saveState(state); }
async function withEscrowState(mutator) { return withLockedState(mutator); }
module.exports = { loadEscrowState, saveEscrowState, withEscrowState };
