const path = require('path');
Object.assign(process.env, {
 NODE_ENV: 'test', HOST: '127.0.0.1', PORT: '3101', DB_DRIVER: 'file',
 TEST_DB_FILE: path.join(__dirname, 'audit.test.json'),
 JWT_SECRET: 'local-qa-only-secret-at-least-32-characters',
 SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', REDIS_ENABLED: 'false',
 STORAGE_DRIVER: 'local', ALLOWED_ORIGINS: 'http://getsocs.test:3101'
});
require('../../server/server').startServer();
