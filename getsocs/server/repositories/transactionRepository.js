const { loadState, saveState, withLockedState } = require('./stateRepository');
async function loadTransactionState() { return loadState(); }
async function saveTransactionState(state) { return saveState(state); }
async function withTransactionState(mutator) { return withLockedState(mutator); }
module.exports = { loadTransactionState, saveTransactionState, withTransactionState };
