// Photo validation utility - mirrors the backend's real limits
// (server/middleware/uploadMiddleware.js + imageDimensionMiddleware.js) so
// users get the same feedback instantly instead of waiting for a server
// round-trip. The backend is still the source of truth and re-validates
// everything - this is just for a faster, friendlier UI.

export const PHOTO_CONSTRAINTS = {
  MAX_SIZE_MB: 8,
  MAX_SIZE_BYTES: 8 * 1024 * 1024,
  MIN_WIDTH: 200,
  MIN_HEIGHT: 200,
  // No hard max dimension client-side: the backend auto-resizes anything
  // over 1920px on the long edge rather than rejecting it, so large photos
  // from phone cameras are still fine to select.
  ALLOWED_FORMATS: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'],
  ALLOWED_EXTENSIONS: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']
};

export async function validatePhoto(file) {
  const errors = [];

  // Check file exists
  if (!file) {
    return { valid: false, errors: ['No file selected'] };
  }

  // Check file size
  if (file.size > PHOTO_CONSTRAINTS.MAX_SIZE_BYTES) {
    errors.push(`File size exceeds ${PHOTO_CONSTRAINTS.MAX_SIZE_MB}MB limit (current: ${(file.size / 1024 / 1024).toFixed(2)}MB)`);
  }

  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  const typeAllowed = PHOTO_CONSTRAINTS.ALLOWED_FORMATS.includes(file.type);
  const extAllowed = PHOTO_CONSTRAINTS.ALLOWED_EXTENSIONS.includes(ext);
  if (!typeAllowed && !extAllowed) {
    errors.push(`File type not supported. Allowed: JPEG, PNG, WebP, HEIC/HEIF (current: ${file.type || ext || 'unknown'})`);
  }

  if (!extAllowed) {
    errors.push(`File extension not allowed (current: ${ext})`);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Check image dimensions
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const imgErrors = [];
        if (img.width < PHOTO_CONSTRAINTS.MIN_WIDTH) {
          imgErrors.push(`Image width too small: ${img.width}px (minimum: ${PHOTO_CONSTRAINTS.MIN_WIDTH}px)`);
        }
        if (img.height < PHOTO_CONSTRAINTS.MIN_HEIGHT) {
          imgErrors.push(`Image height too small: ${img.height}px (minimum: ${PHOTO_CONSTRAINTS.MIN_HEIGHT}px)`);
        }

        resolve({
          valid: imgErrors.length === 0,
          errors: imgErrors,
          dimensions: { width: img.width, height: img.height }
        });
      };
      img.onerror = () => {
        resolve({ valid: false, errors: ['Invalid image file'] });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export async function compressPhoto(file, targetQuality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1920; // Max dimension for compressed image
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        } else if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            resolve({
              compressed: true,
              originalSize: file.size,
              compressedSize: blob.size,
              reduction: ((1 - blob.size / file.size) * 100).toFixed(2),
              file: new File([blob], file.name, { type: 'image/jpeg' })
            });
          },
          'image/jpeg',
          targetQuality
        );
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

export function formatPhotoError(errors) {
  return errors.map(err => `• ${err}`).join('\n');
}
