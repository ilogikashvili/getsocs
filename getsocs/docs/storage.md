# Object storage architecture

## Inventory

Persisted file references currently exist in four places:

- Product images — public.
- User profile photos — public.
- User background photos — public.
- Identity-verification documents — private and authorization-gated.

`server/middleware/imageDimensionMiddleware.js` remains the validation boundary: every accepted image is decoded and re-encoded as JPEG before permanent storage.

## Drivers

`STORAGE_DRIVER=local` preserves the current VPS filesystem behavior. `STORAGE_DRIVER=s3` uploads normalized files through `storageService.js`.

For S3-compatible storage configure `S3_REGION`, `S3_PUBLIC_BUCKET`, `S3_PRIVATE_BUCKET`, and optionally `S3_ENDPOINT`, `S3_PUBLIC_BASE_URL`, and explicit credentials. Prefer instance/workload roles over long-lived access keys when the platform supports them.

Public objects are addressed by object key in MySQL. `/uploads/<object-key>` remains a compatibility route and redirects to the CDN/public bucket (or a signed object URL if no public base URL is configured). This allows the frontend to keep its existing image URL logic during migration.

Private ID documents are never available from `/uploads`. Admin/escrow authorization occurs first, then the backend returns local content or redirects to a short-lived signed private-object URL. After an ID review decision, Getsocs clears the stored image reference and attempts to delete the private object, minimizing retention of identity documents.

## Migration

Run verification first and retain a filesystem/VPS backup:

```bash
cd server
STORAGE_DRIVER=s3 npm run storage:migrate
npm run storage:verify
```

The first command uploads and verifies objects but **does not delete the originals**. After DB references and object existence are verified and a backup exists:

```bash
STORAGE_DRIVER=s3 npm run storage:migrate -- --delete-after-verify
```

The migration refuses to update MySQL if a referenced local object is missing. Originals are only deleted after the updated MySQL state is re-read and every referenced object is confirmed in object storage.

## Bucket controls

- Private bucket: block all public access; encryption at rest; lifecycle rules appropriate for rejected/approved identity documents; server role only.
- Public bucket: write/delete permission only for the backend/deployment role. Public read should preferably go through the configured CDN/domain.
- Enable provider access logging/versioning where operationally useful.
- Never store S3 credentials in source control.
