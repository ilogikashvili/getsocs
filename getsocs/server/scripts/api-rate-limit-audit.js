// Exercise actual middleware outside NODE_ENV=test without loading deployment configuration.
process.env.NODE_ENV = 'development';
process.env.LOGIN_RATE_LIMIT_MAX = '3';
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const path = require('path');
const { loginLimiter } = require('../middleware/rateLimitMiddleware');
const app = express();
app.set('trust proxy', 1); // server.js default; deployment proxy topology is not verified here.
app.post('/login', loginLimiter, (_req, res) => res.status(401).json({ success: false }));
(async () => {
  const results = [];
  for (let i = 0; i < 5; i++) {
    const res = await request(app).post('/login');
    results.push({ scenario: 'same-ip', status: res.status, retryAfter: res.headers['retry-after'] });
  }
  for (let i = 1; i <= 5; i++) {
    const res = await request(app).post('/login').set('X-Forwarded-For', `192.0.2.${i}`);
    results.push({ scenario: 'rotating-forwarded-ip', status: res.status });
  }
  fs.writeFileSync(path.resolve(__dirname, '../../docs/api-audit/rate-limit-probe.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results));
})().catch(e => { console.error(e); process.exitCode = 1; });
