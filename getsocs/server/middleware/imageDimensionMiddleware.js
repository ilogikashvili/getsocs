const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const MIN_DIMENSION = 200;
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 82;
const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp', 'heif']);

function collectFiles(req) {
  if (req.file) return [req.file];
  if (Array.isArray(req.files)) return req.files;
  if (req.files && typeof req.files === 'object') return Object.values(req.files).flat().filter(Boolean);
  return [];
}
function cleanupFiles(files) {
  for (const file of files || []) {
    if (file?.path) fs.unlink(file.path, () => {});
  }
}
async function validateAndNormalizeImages(req, res, next) {
  const files = collectFiles(req);
  if (!files.length) return next();
  try {
    for (const file of files) {
      let metadata;
      try { metadata = await sharp(file.path, { failOn: 'warning' }).metadata(); }
      catch (_) {
        cleanupFiles(files);
        return res.status(400).json({ success: false, error: `"${file.originalname}" is not a valid image.` });
      }
      const { width, height, format } = metadata;
      if (!ALLOWED_FORMATS.has(format)) {
        cleanupFiles(files);
        return res.status(400).json({ success: false, error: `"${file.originalname}" has an unsupported file format.` });
      }
      if (!width || !height || width < MIN_DIMENSION || height < MIN_DIMENSION) {
        cleanupFiles(files);
        return res.status(400).json({ success: false, error: `"${file.originalname}" is too small or malformed. Minimum size is ${MIN_DIMENSION}x${MIN_DIMENSION}px.` });
      }

      // Re-encode every accepted upload. This validates actual image contents,
      // strips metadata/trailing payloads, normalizes orientation and ensures
      // the served file cannot retain an executable/polyglot suffix.
      const originalPath = file.path;
      const dir = path.dirname(originalPath);
      const base = path.basename(originalPath, path.extname(originalPath));
      const tempPath = path.join(dir, `${base}.normalized.jpg`);
      await sharp(originalPath, { failOn: 'warning' })
        .rotate()
        .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY })
        .toFile(tempPath);
      fs.unlinkSync(originalPath);
      const finalPath = path.join(dir, `${base}.jpg`);
      fs.renameSync(tempPath, finalPath);
      file.filename = path.basename(finalPath);
      file.path = finalPath;
      file.mimetype = 'image/jpeg';
    }
    next();
  } catch (e) {
    cleanupFiles(files);
    next(Object.assign(new Error('Failed to process uploaded images.'), { status: 500, cause: e }));
  }
}
module.exports = { validateAndNormalizeImages, cleanupFiles, collectFiles, MIN_DIMENSION, MAX_DIMENSION };
