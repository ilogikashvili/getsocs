#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
try { require('dotenv').config({ path: path.join(__dirname, '..', '.env') }); } catch (_) {}
const { initializeDatabase, closeDatabase } = require('../config/db');
const { loadState, saveState } = require('../repositories/stateRepository');
const storage = require('../services/storageService');
const { UPLOADS, PRIVATE_UPLOADS } = require('../middleware/uploadMiddleware');

const deleteAfterVerify = process.argv.includes('--delete-after-verify');
if (storage.getDriver() !== 's3') {
  console.error('Set STORAGE_DRIVER=s3 and the S3 environment variables before running this migration.');
  process.exit(1);
}

function localFile(root, key) {
  if (!key || String(key).includes('/')) return null; // already looks migrated
  const file = path.resolve(root, path.basename(String(key)));
  return file.startsWith(path.resolve(root) + path.sep) && fs.existsSync(file) ? file : null;
}

(async () => {
  await initializeDatabase();
  const state = await loadState();
  const migrated = new Map();
  const originals = [];
  const missing = [];
  async function migrateKey(oldKey, visibility, prefix) {
    if (!oldKey) return oldKey;
    const mapKey = `${visibility}:${oldKey}`;
    if (migrated.has(mapKey)) return migrated.get(mapKey);
    const root = visibility === 'private' ? PRIVATE_UPLOADS : UPLOADS;
    const file = localFile(root, oldKey);
    if (!file) {
      if (await storage.exists(oldKey, visibility).catch(() => false)) return oldKey;
      missing.push({ visibility, key: oldKey });
      return oldKey;
    }
    const newKey = await storage.putFile(file, { visibility, prefix });
    if (!(await storage.exists(newKey, visibility))) throw new Error(`Verification failed after upload: ${visibility}:${newKey}`);
    migrated.set(mapKey, newKey); originals.push(file); return newKey;
  }

  for (const product of state.products || []) {
    const images = Array.isArray(product.images) ? product.images : (product.image ? [product.image] : []);
    const next=[];
    for (const image of images) next.push(await migrateKey(image, 'public', `products/${product.id}`));
    product.images=next; if (product.image) delete product.image;
  }
  for (const user of state.users || []) {
    if (user.profilePhoto) user.profilePhoto = await migrateKey(user.profilePhoto, 'public', `profiles/${user.id}`);
    if (user.backgroundPhoto) user.backgroundPhoto = await migrateKey(user.backgroundPhoto, 'public', `profiles/${user.id}`);
    if (user.verificationDocument?.imageFile) user.verificationDocument.imageFile = await migrateKey(user.verificationDocument.imageFile, 'private', `identity/${user.id}`);
  }

  if (missing.length) {
    console.error(`Refusing to update database: ${missing.length} referenced local objects could not be found or verified.`);
    console.error(JSON.stringify(missing.slice(0, 50), null, 2));
    process.exitCode=2; return;
  }
  await saveState(state);

  // Re-read from the authoritative DB and verify every updated reference before
  // any local file is eligible for deletion.
  const verified = await loadState();
  const refs=[];
  for (const p of verified.products || []) for (const key of (p.images || [])) refs.push(['public',key]);
  for (const u of verified.users || []) {
    if (u.profilePhoto) refs.push(['public',u.profilePhoto]);
    if (u.backgroundPhoto) refs.push(['public',u.backgroundPhoto]);
    if (u.verificationDocument?.imageFile) refs.push(['private',u.verificationDocument.imageFile]);
  }
  for (const [visibility,key] of refs) if (!(await storage.exists(key,visibility))) throw new Error(`Post-migration verification failed: ${visibility}:${key}`);

  if (deleteAfterVerify) {
    for (const file of [...new Set(originals)]) { try { await fs.promises.unlink(file); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  }
  console.log(JSON.stringify({ migratedObjects:migrated.size, verifiedReferences:refs.length, localOriginalsDeleted:deleteAfterVerify ? new Set(originals).size : 0 }, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exitCode=1; }).finally(async()=>{ await storage.close().catch(()=>{}); await closeDatabase().catch(()=>{}); });
