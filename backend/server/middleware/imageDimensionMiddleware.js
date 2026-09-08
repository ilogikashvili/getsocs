const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Bounds for listing photos. Below MIN, an image is unusably small (often a
// placeholder, icon, or screenshot thumbnail rather than a real product
// photo). Above MAX, we don't reject - phone cameras routinely produce much
// larger images than any web listing needs - we just resize it down and
// re-encode so storage/bandwidth stays reasonable.
const MIN_DIMENSION = 200;
const MAX_DIMENSION = 1920;
const JPEG_QUALITY = 82;

function cleanupFiles(files) {
  for (const file of files || []) {
    fs.unlink(file.path, () => {});
  }
}

/**
 * Runs after multer has written files to disk. For each uploaded image:
 *  - decodes it with sharp to confirm it's a real, readable image (catches
 *    corrupt files and files that lied about their mimetype)
 *  - rejects images smaller than MIN_DIMENSION on either axis
 *  - resizes anything larger than MAX_DIMENSION on the long edge down to fit,
 *    re-encoding as JPEG at JPEG_QUALITY - this also reliably normalizes
 *    format/orientation (EXIF rotation) and shrinks file size
 *
 * On any failure, all files from this request are deleted (no orphaned
 * uploads) and the request is rejected with a clear, specific message.
 */
async function validateAndNormalizeImages(req, res, next) {
  const files = req.files;
  if (!Array.isArray(files) || files.length === 0) return next();

  try {
    for (const file of files) {
      let metadata;
      try {
        metadata = await sharp(file.path).metadata();
      } catch (decodeError) {
        cleanupFiles(files);
        return res.status(400).json({
          success: false,
          error: `"${file.originalname}" could not be read as a valid image. Please try a different file.`
        });
      }

      const { width, height } = metadata;
      if (!width || !height) {
        cleanupFiles(files);
        return res.status(400).json({
          success: false,
          error: `"${file.originalname}" has no readable dimensions and can't be used.`
        });
      }

      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        cleanupFiles(files);
        return res.status(400).json({
          success: false,
          error: `"${file.originalname}" is too small (${width}x${height}px). Minimum size is ${MIN_DIMENSION}x${MIN_DIMENSION}px.`
        });
      }

      if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
        const originalPath = file.path;
        const dir = path.dirname(originalPath);
        const base = path.basename(originalPath, path.extname(originalPath));
        // Always resize into a distinct temp file first - if the source was
        // already .jpg, the "final" path can collide with originalPath, and
        // sharp refuses to use the same file as both input and output.
        const tempPath = path.join(dir, `${base}.resized.jpg`);
        const finalPath = path.join(dir, `${base}.jpg`);

        await sharp(originalPath)
          .rotate() // apply EXIF orientation before resizing, then strip it
          .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: JPEG_QUALITY })
          .toFile(tempPath);

        if (originalPath !== finalPath) {
          fs.unlink(originalPath, () => {});
        }
        fs.renameSync(tempPath, finalPath);

        file.filename = path.basename(finalPath);
        file.path = finalPath;
        file.mimetype = 'image/jpeg';
      }
    }

    next();
  } catch (e) {
    console.error('Image processing error:', e);
    cleanupFiles(files);
    res.status(500).json({ success: false, error: 'Failed to process uploaded images.' });
  }
}

module.exports = { validateAndNormalizeImages, MIN_DIMENSION, MAX_DIMENSION };
