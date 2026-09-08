const { loadState, saveState, withLockedState } = require('./stateRepository');
async function loadChatState() { return loadState(); }
async function saveChatState(state) { return saveState(state); }
async function withChatState(mutator) { return withLockedState(mutator); }
module.exports = { loadChatState, saveChatState, withChatState };
