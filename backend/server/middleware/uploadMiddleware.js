const multer = require('multer');
const path = require('path');
const fs = require('fs');
const UPLOADS = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(UPLOADS)) fs.mkdirSync(UPLOADS, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || '';
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
    cb(null, safeName);
  }
});

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const upload = multer({
  storage,
  // 8MB per file. The old 50MB limit was unreasonably generous for listing
  // photos and let people upload huge, unoptimized files. Dimension
  // validation and auto-resizing happen afterwards in
  // imageDimensionMiddleware.js, which needs the file to actually be
  // decodable, so the format allow-list below is deliberately narrower than
  // "any image/*" (e.g. no SVG, which isn't a raster format sharp resizes
  // and can carry embedded scripts).
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      const err = new Error('Only JPEG, PNG, or WebP images are allowed');
      err.status = 400;
      cb(err, false);
    }
  }
});

module.exports = { upload, UPLOADS, ALLOWED_MIME_TYPES };
