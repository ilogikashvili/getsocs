# Getsocs object-storage production controls

Getsocs supports `STORAGE_DRIVER=local|s3`. The S3-compatible design deliberately separates public marketplace/profile assets from private identity documents.

## Recommended buckets

- `getsocs-public` — product/profile images. Prefer a CDN/private-origin design instead of making the bucket itself broadly writable or listable.
- `getsocs-private` — identity documents. Keep block-public-access enabled and permit access only to the application identity. Never expose this bucket through `/uploads`.

The application stores object **keys** in MySQL, not permanent signed URLs. Private reads pass backend authorization and use a short-lived signed URL only after authorization succeeds.

## Required controls

1. Encryption at rest (the application requests AES-256 server-side encryption on each upload).
2. TLS for transport; deny insecure transport at the bucket policy layer.
3. Application credentials limited to the two Getsocs buckets; never use root/account-owner credentials.
4. No public listing permissions.
5. Versioning recommended for private objects and useful for public assets during migration/rollback.
6. Lifecycle rules should clean abandoned multipart uploads and, if business/legal requirements permit, expire old noncurrent versions.
7. Enable provider access/audit logs where available.
8. Configure CORS only if browsers upload directly in a future design. Current Getsocs uploads pass through the backend, so permissive bucket CORS is unnecessary.

## Migration sequence

```bash
cd server
STORAGE_DRIVER=s3 npm run storage:verify       # verify already-referenced object keys, if any
STORAGE_DRIVER=s3 npm run storage:migrate      # copies and verifies; retains originals
STORAGE_DRIVER=s3 npm run storage:verify
```

Only after the migration has been reviewed and backed up:

```bash
STORAGE_DRIVER=s3 npm run storage:migrate -- --delete-after-verify
```

The migration refuses to update MySQL if a referenced local source cannot be found or a newly uploaded object cannot be verified. Original VPS files are retained by default.

## Private access acceptance test

- Regular user requests another user's ID document: `403`/not routable.
- Public `/uploads/<private-key>`: `404`.
- Authorized admin/escrow reviewer: backend checks role, then serves local private object or redirects to a short-lived private signed URL.
