const { spawnSync } = require('child_process');
const path = require('path');
const cwd = path.resolve(__dirname, '../../server');
const result = spawnSync(process.execPath, [path.join(cwd, 'node_modules/jest/bin/jest.js'), '--runInBand', '--json', '--outputFile=../docs/qa-audit/backend-isolated-results.json'], {
 cwd, stdio: 'inherit', env: { ...process.env, NODE_ENV: 'test', TEST_DB_FILE: 'server.test.json', SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', REDIS_ENABLED: 'false' }
});
process.exitCode = result.status || 0;
