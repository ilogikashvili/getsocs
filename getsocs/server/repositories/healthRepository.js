const { loadState } = require('./stateRepository');
async function loadHealthState() { return loadState(); }
module.exports = { loadHealthState };
