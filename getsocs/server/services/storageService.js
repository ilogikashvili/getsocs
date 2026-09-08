const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const logger = require('../utils/logger');
const { UPLOADS, PRIVATE_UPLOADS } = require('../middleware/uploadMiddleware');

const driver = String(process.env.STORAGE_DRIVER || 'local').toLowerCase();
const signedUrlTtl = Math.max(30, Math.min(3600, Number(process.env.S3_SIGNED_URL_TTL_SECONDS || 300)));
let s3Client = null;

function assertSafeKey(key) {
  const value = String(key || '').replace(/\\/g, '/').replace(/^\/+/, '');
  if (!value || value.includes('..') || value.includes('\0')) throw Object.assign(new Error('Invalid storage key'), { status: 400 });
  return value;
}
function safePrefix(prefix) {
  return String(prefix || '').split('/').filter(Boolean).map(part => part.replace(/[^A-Za-z0-9._-]/g, '_')).join('/');
}
function objectKey(prefix, sourcePath) {
  const ext = path.extname(sourcePath).toLowerCase() || '.jpg';
  const name = `${crypto.randomBytes(24).toString('hex')}${ext}`;
  return [safePrefix(prefix), name].filter(Boolean).join('/');
}
function localPath(root, key) {
  const safe = assertSafeKey(key);
  const resolved = path.resolve(root, safe);
  const base = path.resolve(root) + path.sep;
  if (!resolved.startsWith(base)) throw Object.assign(new Error('Invalid storage key'), { status: 400 });
  return resolved;
}
function getAws() {
  try {
    const s3 = require('@aws-sdk/client-s3');
    const presigner = require('@aws-sdk/s3-request-presigner');
    return { ...s3, ...presigner };
  } catch (error) {
    const wrapped = new Error('AWS S3 SDK packages are required when STORAGE_DRIVER=s3. Run npm install in server/.');
    wrapped.cause = error; throw wrapped;
  }
}
function getS3Client() {
  if (s3Client) return s3Client;
  const { S3Client } = getAws();
  const config = {
    region: process.env.S3_REGION,
    endpoint: process.env.S3_ENDPOINT || undefined,
    forcePathStyle: String(process.env.S3_FORCE_PATH_STYLE || 'false').toLowerCase() === 'true'
  };
  if (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) {
    config.credentials = { accessKeyId: process.env.S3_ACCESS_KEY_ID, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY };
  }
  s3Client = new S3Client(config); return s3Client;
}
function bucketFor(visibility) { return visibility === 'private' ? process.env.S3_PRIVATE_BUCKET : process.env.S3_PUBLIC_BUCKET; }
function rootFor(visibility) { return visibility === 'private' ? PRIVATE_UPLOADS : UPLOADS; }

async function putFile(sourcePath, { visibility = 'public', prefix = '' } = {}) {
  if (!fs.existsSync(sourcePath)) throw Object.assign(new Error('Upload source file not found'), { status: 400 });
  if (driver === 'local') {
    // Multer already wrote the normalized file into the correct local root.
    return path.basename(sourcePath);
  }
  const key = objectKey(prefix, sourcePath);
  const { PutObjectCommand } = getAws();
  await getS3Client().send(new PutObjectCommand({
    Bucket: bucketFor(visibility), Key: key, Body: fs.createReadStream(sourcePath), ContentType: 'image/jpeg',
    ServerSideEncryption: 'AES256', CacheControl: visibility === 'public' ? 'public, max-age=31536000, immutable' : 'no-store'
  }));
  return key;
}
async function deleteObject(key, visibility = 'public') {
  if (!key) return false;
  const safe = assertSafeKey(key);
  if (driver === 'local') {
    try { await fs.promises.unlink(localPath(rootFor(visibility), safe)); return true; }
    catch (error) { if (error.code === 'ENOENT') return false; throw error; }
  }
  const { DeleteObjectCommand } = getAws();
  await getS3Client().send(new DeleteObjectCommand({ Bucket: bucketFor(visibility), Key: safe })); return true;
}
async function exists(key, visibility = 'public') {
  const safe = assertSafeKey(key);
  if (driver === 'local') return fs.existsSync(localPath(rootFor(visibility), safe));
  const { HeadObjectCommand } = getAws();
  try { await getS3Client().send(new HeadObjectCommand({ Bucket: bucketFor(visibility), Key: safe })); return true; }
  catch (error) { if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return false; throw error; }
}
async function getMetadata(key, visibility = 'public') {
  const safe = assertSafeKey(key);
  if (driver === 'local') {
    const stat = await fs.promises.stat(localPath(rootFor(visibility), safe));
    return { key: safe, size: stat.size, lastModified: stat.mtime.toISOString(), driver: 'local' };
  }
  const { HeadObjectCommand } = getAws();
  const result = await getS3Client().send(new HeadObjectCommand({ Bucket: bucketFor(visibility), Key: safe }));
  return { key: safe, size: Number(result.ContentLength || 0), lastModified: result.LastModified?.toISOString?.() || null, driver: 's3' };
}
async function signedUrl(key, visibility = 'private') {
  if (driver === 'local') return null;
  const safe = assertSafeKey(key); const { GetObjectCommand, getSignedUrl } = getAws();
  return getSignedUrl(getS3Client(), new GetObjectCommand({ Bucket: bucketFor(visibility), Key: safe }), { expiresIn: signedUrlTtl });
}
async function publicUrl(key) {
  const safe = assertSafeKey(key);
  if (driver === 'local') return `/uploads/${safe}`;
  const base = String(process.env.S3_PUBLIC_BASE_URL || '').replace(/\/+$/, '');
  if (base) return `${base}/${safe.split('/').map(encodeURIComponent).join('/')}`;
  return signedUrl(safe, 'public');
}
async function sendPublicObject(res, key) {
  const safe = assertSafeKey(key);
  if (driver === 'local') {
    const file = localPath(UPLOADS, safe); if (!fs.existsSync(file)) return res.status(404).json({ success:false, error:'File not found' });
    return res.sendFile(file);
  }
  if (!(await exists(safe, 'public'))) return res.status(404).json({ success:false, error:'File not found' });
  return res.redirect(302, await publicUrl(safe));
}
async function sendPrivateObject(res, key) {
  const safe = assertSafeKey(key); res.setHeader('Cache-Control', 'no-store');
  if (driver === 'local') {
    const file = localPath(PRIVATE_UPLOADS, safe); if (!fs.existsSync(file)) return res.status(404).json({ success:false, error:'Verification document not found' });
    res.setHeader('Content-Disposition', 'inline'); return res.sendFile(file);
  }
  if (!(await exists(safe, 'private'))) return res.status(404).json({ success:false, error:'Verification document not found' });
  return res.redirect(302, await signedUrl(safe, 'private'));
}
async function cleanupStaging(files) {
  if (driver !== 's3') return;
  for (const file of files || []) { if (file?.path) { try { await fs.promises.unlink(file.path); } catch (error) { if (error.code !== 'ENOENT') logger.warn('Staging upload cleanup failed', { error }); } } }
}
async function close() { if (s3Client?.destroy) s3Client.destroy(); s3Client = null; }
function getDriver() { return driver; }
function _setS3ClientForTests(client) { s3Client = client; }
module.exports = { putFile, deleteObject, exists, getMetadata, signedUrl, publicUrl, sendPublicObject, sendPrivateObject, cleanupStaging, close, getDriver, assertSafeKey, _setS3ClientForTests };
