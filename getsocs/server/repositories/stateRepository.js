// MySQL-backed persistence adapter. Domain repositories remain the boundary
// consumed by business logic, allowing gradual migration to narrower queries.
const { loadState, saveState, withDbLock } = require('../config/db');

async function loadStateFromDb() { return await loadState(); }
async function saveStateToDb(state) { return await saveState(state); }
async function withLockedState(mutator) { return withDbLock(mutator); }

module.exports = { loadState: loadStateFromDb, saveState: saveStateToDb, withLockedState };
