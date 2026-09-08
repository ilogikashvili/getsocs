const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const UPLOADS = path.join(__dirname, '..', 'uploads');
const PRIVATE_UPLOADS = path.join(__dirname, '..', 'private_uploads');
for (const dir of [UPLOADS, PRIVATE_UPLOADS]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o750 });
}

function makeStorage(destination) {
  return multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, destination),
  // Never preserve a client-controlled filename or extension on disk.
  filename: (_req, _file, cb) => cb(null, crypto.randomBytes(24).toString('hex'))
  });
}
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
function createUpload(destination) {
  return multer({
  storage: makeStorage(destination),
  limits: { fileSize: 8 * 1024 * 1024, files: 7, fields: 40, parts: 50 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) cb(null, true);
    else cb(Object.assign(new Error('Only JPEG, PNG, WebP, HEIC, or HEIF images are allowed'), { status: 400 }), false);
  }
  });
}
const upload = createUpload(UPLOADS);
const privateUpload = createUpload(PRIVATE_UPLOADS);
module.exports = { upload, privateUpload, UPLOADS, PRIVATE_UPLOADS, ALLOWED_MIME_TYPES };
