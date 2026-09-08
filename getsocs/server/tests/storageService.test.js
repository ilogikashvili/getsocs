const fs = require('fs');
const os = require('os');
const path = require('path');

describe('storageService local driver safety', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.STORAGE_DRIVER = 'local';
  });
  afterEach(() => { delete process.env.STORAGE_DRIVER; });

  test('rejects path traversal storage keys', () => {
    const storage = require('../services/storageService');
    expect(() => storage.assertSafeKey('../secret')).toThrow(/Invalid storage key/);
    expect(() => storage.assertSafeKey('folder/../../secret')).toThrow(/Invalid storage key/);
  });

  test('local public upload preserves normalized multer filename', async () => {
    const storage = require('../services/storageService');
    const { UPLOADS } = require('../middleware/uploadMiddleware');
    fs.mkdirSync(UPLOADS, { recursive: true });
    const source = path.join(UPLOADS, `storage-test-${Date.now()}.jpg`);
    fs.writeFileSync(source, Buffer.from('test'));
    await expect(storage.putFile(source, { visibility: 'public', prefix: 'ignored' })).resolves.toBe(path.basename(source));
    await expect(storage.exists(path.basename(source), 'public')).resolves.toBe(true);
    await expect(storage.deleteObject(path.basename(source), 'public')).resolves.toBe(true);
  });

  test('private and public roots remain separated', async () => {
    const storage = require('../services/storageService');
    const { PRIVATE_UPLOADS } = require('../middleware/uploadMiddleware');
    const key = `private-test-${Date.now()}.jpg`;
    const file = path.join(PRIVATE_UPLOADS, key);
    fs.mkdirSync(PRIVATE_UPLOADS, { recursive: true }); fs.writeFileSync(file, 'private');
    await expect(storage.exists(key, 'private')).resolves.toBe(true);
    await expect(storage.exists(key, 'public')).resolves.toBe(false);
    await storage.deleteObject(key, 'private');
  });
});

describe('storageService S3 driver', () => {
  let send;
  let getSignedUrl;
  let tmpDir;

  async function drainBody(input) {
    if (!input?.Body || typeof input.Body.on !== 'function') return;
    await new Promise((resolve, reject) => {
      input.Body.on('error', reject);
      input.Body.on('end', resolve);
      input.Body.resume();
    });
  }

  beforeEach(() => {
    jest.resetModules();
    process.env.STORAGE_DRIVER = 's3';
    process.env.S3_REGION = 'us-east-1';
    process.env.S3_PUBLIC_BUCKET = 'getsocs-public-test';
    process.env.S3_PRIVATE_BUCKET = 'getsocs-private-test';
    process.env.S3_SIGNED_URL_TTL_SECONDS = '120';
    send = jest.fn(async (command) => { await drainBody(command.input); return {}; });
    getSignedUrl = jest.fn(async (_client, command, options) => `https://signed.example/${command.input.Key}?ttl=${options.expiresIn}`);

    class S3Client { constructor() { this.send = send; } destroy() {} }
    class PutObjectCommand { constructor(input) { this.input = input; } }
    class DeleteObjectCommand { constructor(input) { this.input = input; } }
    class HeadObjectCommand { constructor(input) { this.input = input; } }
    class GetObjectCommand { constructor(input) { this.input = input; } }

    jest.doMock('@aws-sdk/client-s3', () => ({ S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand, GetObjectCommand }), { virtual: true });
    jest.doMock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl }), { virtual: true });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'getsocs-s3-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    for (const key of ['STORAGE_DRIVER','S3_REGION','S3_PUBLIC_BUCKET','S3_PRIVATE_BUCKET','S3_SIGNED_URL_TTL_SECONDS']) delete process.env[key];
    jest.restoreAllMocks();
  });

  test('uploads public and private objects to separate buckets', async () => {
    const storage = require('../services/storageService');
    const publicSource = path.join(tmpDir, 'public.jpg');
    const privateSource = path.join(tmpDir, 'private.jpg');
    fs.writeFileSync(publicSource, 'public-image');
    fs.writeFileSync(privateSource, 'private-image');

    const publicKey = await storage.putFile(publicSource, { visibility: 'public', prefix: 'products/p1' });
    const privateKey = await storage.putFile(privateSource, { visibility: 'private', prefix: 'verification/u1' });

    expect(publicKey).toMatch(/^products\/p1\/[a-f0-9]{48}\.jpg$/);
    expect(privateKey).toMatch(/^verification\/u1\/[a-f0-9]{48}\.jpg$/);
    expect(send.mock.calls[0][0].input).toMatchObject({ Bucket: 'getsocs-public-test', Key: publicKey, ServerSideEncryption: 'AES256' });
    expect(send.mock.calls[1][0].input).toMatchObject({ Bucket: 'getsocs-private-test', Key: privateKey, ServerSideEncryption: 'AES256', CacheControl: 'no-store' });
  });

  test('private access produces a short-lived signed URL for the private bucket', async () => {
    const storage = require('../services/storageService');
    const url = await storage.signedUrl('verification/u1/document.jpg', 'private');
    expect(url).toContain('verification/u1/document.jpg');
    expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ input: expect.objectContaining({ Bucket: 'getsocs-private-test' }) }), { expiresIn: 120 });
  });

  test('missing object is reported as absent', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('not found'), { name: 'NotFound', $metadata: { httpStatusCode: 404 } }));
    const storage = require('../services/storageService');
    await expect(storage.exists('products/missing.jpg', 'public')).resolves.toBe(false);
  });

  test('storage failures propagate so callers can roll back database/file changes', async () => {
    send.mockImplementationOnce(async (command) => {
      await drainBody(command.input);
      throw new Error('s3 unavailable');
    });
    const storage = require('../services/storageService');
    const source = path.join(tmpDir, 'failure.jpg');
    fs.writeFileSync(source, 'image');
    await expect(storage.putFile(source, { visibility: 'public', prefix: 'products/p1' })).rejects.toThrow('s3 unavailable');
  });
});
