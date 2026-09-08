const { loadState, saveState, withLockedState } = require('./stateRepository');
const { loadUserById, updateUserLastActive } = require('../config/db');
async function loadAuthState() { return loadState(); }
async function saveAuthState(state) { return saveState(state); }
async function withAuthState(mutator) { return withLockedState(mutator); }
module.exports = { loadAuthState, saveAuthState, withAuthState, loadUserById, updateUserLastActive };
