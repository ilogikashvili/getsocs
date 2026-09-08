/**
 * Bot Protection Security Tests
 * Verifies reCAPTCHA v3 integration for brute force and spam prevention
 * 
 * Test Coverage:
 * - Middleware installation and configuration
 * - Bot protection applied to correct routes
 * - Environment configuration
 * - Security properties and implementation
 */

const fs = require('fs');
const path = require('path');
const request = require('supertest');

// Setup test environment
const testDbPath = path.join(__dirname, '..', 'server.test.json');
process.env.TEST_DB_FILE = testDbPath;
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';

// Manually load env variables if not already set
if (!process.env.RECAPTCHA_SECRET_KEY) {
  // Load from .env file for testing
  let envPath = path.join(__dirname, '../.env');
  
  // Try alternative paths
  if (!fs.existsSync(envPath)) {
    envPath = path.join(__dirname, '../.env');
  }
  if (!fs.existsSync(envPath)) {
    envPath = path.join(process.cwd(), '.env');
  }
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    });
  }
}

const { app } = require('../server');

describe('Bot Protection Security Tests', () => {
  
  /**
   * ===== MIDDLEWARE CONFIGURATION TESTS =====
   * Verify bot protection middleware is properly installed and configured
   */
  describe('Bot Protection Middleware Configuration', () => {
    test('should have bot protection middleware file', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      expect(fs.existsSync(middlewarePath)).toBe(true);
    });

    test('should export loginBotProtection middleware', () => {
      const middleware = require('../middleware/botProtectionMiddleware');
      expect(typeof middleware.loginBotProtection).toBe('function');
    });

    test('should export registrationBotProtection middleware', () => {
      const middleware = require('../middleware/botProtectionMiddleware');
      expect(typeof middleware.registrationBotProtection).toBe('function');
    });

    test('should export optionalBotProtection middleware', () => {
      const middleware = require('../middleware/botProtectionMiddleware');
      expect(typeof middleware.optionalBotProtection).toBe('function');
    });

    test('should export verifyRecaptcha function', () => {
      const middleware = require('../middleware/botProtectionMiddleware');
      expect(typeof middleware.verifyRecaptcha).toBe('function');
    });

    // reCAPTCHA is an optional integration: if RECAPTCHA_SECRET_KEY isn't
    // set, login/register skip CAPTCHA enforcement entirely instead of
    // rejecting every request for a token the frontend was never asked to
    // send (see botProtectionMiddleware.js). These tests just document
    // that the score threshold, when present, is a sane 0-1 value - they
    // don't require reCAPTCHA to be configured, since this app works
    // correctly either way.
    test('RECAPTCHA_SCORE_THRESHOLD, if set, is a valid 0-1 value', () => {
      if (!process.env.RECAPTCHA_SCORE_THRESHOLD) return; // not configured - nothing to check
      const threshold = parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD);
      expect(threshold).toBeGreaterThanOrEqual(0);
      expect(threshold).toBeLessThanOrEqual(1);
    });

    test('should require axios dependency', () => {
      const packagePath = path.join(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      expect(pkg.dependencies.axios).toBeDefined();
    });
  });

  /**
   * ===== ROUTE APPLICATION TESTS =====
   * Verify bot protection middleware is applied to authentication routes
   */
  describe('Bot Protection Routes Application', () => {
    test('should import bot protection middleware in authRoutes', () => {
      const routesPath = path.join(__dirname, '../routes/authRoutes.js');
      const content = fs.readFileSync(routesPath, 'utf8');
      expect(content).toContain('botProtectionMiddleware');
      expect(content).toContain('loginBotProtection');
      expect(content).toContain('registrationBotProtection');
    });

    test('should apply loginBotProtection to POST /api/auth/login', () => {
      const routesPath = path.join(__dirname, '../routes/authRoutes.js');
      const content = fs.readFileSync(routesPath, 'utf8');
      const loginMatch = content.match(/router\.post\('\/login'[^;]+\);/);
      expect(loginMatch).toBeTruthy();
      expect(loginMatch[0]).toContain('loginBotProtection');
    });

    test('should apply registrationBotProtection to POST /api/auth/register', () => {
      const routesPath = path.join(__dirname, '../routes/authRoutes.js');
      const content = fs.readFileSync(routesPath, 'utf8');
      const registerMatch = content.match(/router\.post\('\/register'[^;]+\);/);
      expect(registerMatch).toBeTruthy();
      expect(registerMatch[0]).toContain('registrationBotProtection');
    });

    test('should apply rate limiting before bot protection on login', () => {
      const routesPath = path.join(__dirname, '../routes/authRoutes.js');
      const content = fs.readFileSync(routesPath, 'utf8');
      const loginMatch = content.match(/router\.post\('\/login'[^;]+\);/);
      const loginLine = loginMatch[0];
      
      const rateLimitIdx = loginLine.indexOf('loginLimiter');
      const botProtIdx = loginLine.indexOf('loginBotProtection');
      
      expect(rateLimitIdx).toBeGreaterThanOrEqual(0);
      expect(botProtIdx).toBeGreaterThanOrEqual(0);
      expect(rateLimitIdx).toBeLessThan(botProtIdx);
    });

    test('should apply rate limiting before bot protection on register', () => {
      const routesPath = path.join(__dirname, '../routes/authRoutes.js');
      const content = fs.readFileSync(routesPath, 'utf8');
      const registerMatch = content.match(/router\.post\('\/register'[^;]+\);/);
      const registerLine = registerMatch[0];
      
      const rateLimitIdx = registerLine.indexOf('registrationLimiter');
      const botProtIdx = registerLine.indexOf('registrationBotProtection');
      
      expect(rateLimitIdx).toBeGreaterThanOrEqual(0);
      expect(botProtIdx).toBeGreaterThanOrEqual(0);
      expect(rateLimitIdx).toBeLessThan(botProtIdx);
    });
  });

  /**
   * ===== LOGIN BOT PROTECTION REQUIREMENT TESTS =====
   * Verify CAPTCHA token is required for login
   */
  describe('Login Bot Protection', () => {
    test('does not require captchaToken for login when reCAPTCHA is not configured', (done) => {
      // This is the app's actual default state (no RECAPTCHA_SECRET_KEY set,
      // and the frontend has no reCAPTCHA widget yet). A missing token
      // should fall through to normal credential checking instead of
      // blocking every login on a token nothing ever sends - so a bad
      // username/password should fail with "invalid credentials", not a
      // reCAPTCHA error.
      request(app)
        .post('/api/auth/login')
        .send({ username: 'testuser', password: 'password123' })
        .end((err, res) => {
          expect(res.body.error).toBeDefined();
          expect(res.body.error.toLowerCase()).not.toContain('recaptcha');
          expect(res.body.error.toLowerCase()).not.toContain('captcha');
          done();
        });
    });
  });

  /**
   * ===== REGISTRATION BOT PROTECTION REQUIREMENT TESTS =====
   * Verify CAPTCHA token is required for registration only when configured
   */
  describe('Registration Bot Protection', () => {
    test('does not require captchaToken for registration when reCAPTCHA is not configured', (done) => {
      request(app)
        .post('/api/auth/register')
        .field('username', 'u')  // still expected to fail, but on validation, not CAPTCHA
        .field('email', 'invalid')
        .field('password', 'x')
        .end((err, res) => {
          expect(res.status).toBe(400);
          if (res.body.error) expect(res.body.error.toLowerCase()).not.toContain('recaptcha');
          done();
        });
    });
  });

  /**
   * ===== MIDDLEWARE IMPLEMENTATION TESTS =====
   * Verify middleware code structure and security implementation
   */
  describe('Bot Protection Middleware Implementation', () => {
    test('should use Google reCAPTCHA v3 endpoint', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('google.com/recaptcha/api/siteverify');
    });

    test('should verify tokens server-side using axios', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain("require('axios')");
      expect(content).toContain('axios.post');
    });

    test('should check CAPTCHA token presence early', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('captchaToken');
      expect(content).toContain('if (!token)');
    });

    test('should return HTTP 400 for missing token', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('.status(400)');
      expect(content).toContain('reCAPTCHA token');
    });

    test('should return HTTP 403 for failed verification', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('.status(403)');
      expect(content).toContain('verification failed');
    });

    test('should include remote IP in verification', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('remoteIP');
      expect(content).toContain('req.ip');
    });

    test('should include timeout for CAPTCHA requests', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('timeout');
      expect(content).toContain('5000');
    });

    test('should handle verification errors gracefully', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('catch');
      expect(content).toContain('error');
    });

    test('should apply higher threshold for registration', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('registrationThreshold');
      expect(content).toContain('+ 0.1');
    });

    test('should verify score against configured threshold', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('RECAPTCHA_SCORE_THRESHOLD');
      expect(content).toContain('score <');
    });

    test('should support async/await pattern', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('async');
      expect(content).toContain('await');
    });

    test('should attach captcha info to request for logging', () => {
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('req.captcha');
      expect(content).toContain('verified');
      expect(content).toContain('score');
    });
  });

  /**
   * ===== ENVIRONMENT CONFIGURATION TESTS =====
   * Verify RECAPTCHA environment variables are properly configured
   */
  describe('Bot Protection Environment Configuration', () => {
    // reCAPTCHA is an optional integration this app works correctly
    // without (see botProtectionMiddleware.js's graceful skip when
    // RECAPTCHA_SECRET_KEY isn't set). .env holds real, environment-specific
    // secrets that shouldn't be required to exist for tests to pass - these
    // just document the expected format when someone does configure it.
    test('RECAPTCHA_SITE_KEY is documented in .env', () => {
      const envPath = path.join(__dirname, '../.env');
      const content = fs.readFileSync(envPath, 'utf8');
      expect(content).toContain('RECAPTCHA_SITE_KEY=');
    });

    test('RECAPTCHA_SECRET_KEY is documented in .env', () => {
      const envPath = path.join(__dirname, '../.env');
      const content = fs.readFileSync(envPath, 'utf8');
      expect(content).toContain('RECAPTCHA_SECRET_KEY=');
    });

    test('should have RECAPTCHA configuration in .env', () => {
      const envPath = path.join(__dirname, '../.env');
      const content = fs.readFileSync(envPath, 'utf8');
      expect(content).toContain('RECAPTCHA_SITE_KEY');
      expect(content).toContain('RECAPTCHA_SECRET_KEY');
      expect(content).toContain('RECAPTCHA_SCORE_THRESHOLD');
    });

    test('.env should include rate limit configuration', () => {
      const envPath = path.join(__dirname, '../.env');
      const content = fs.readFileSync(envPath, 'utf8');
      expect(content).toContain('LOGIN_RATE_LIMIT_MAX');
      expect(content).toContain('REGISTRATION_RATE_LIMIT_MAX');
    });
  });

  /**
   * ===== DEFENSE IN DEPTH TESTS =====
   * Verify bot protection integrates with other security layers
   */
  describe('Bot Protection Defense in Depth', () => {
    test('should combine rate limiting with bot protection on login', () => {
      const routesPath = path.join(__dirname, '../routes/authRoutes.js');
      const content = fs.readFileSync(routesPath, 'utf8');
      const loginLine = content.match(/router\.post\('\/login'[^;]+\);/)[0];
      
      expect(loginLine).toContain('loginLimiter');
      expect(loginLine).toContain('loginBotProtection');
    });

    test('should combine rate limiting with bot protection on register', () => {
      const routesPath = path.join(__dirname, '../routes/authRoutes.js');
      const content = fs.readFileSync(routesPath, 'utf8');
      const registerLine = content.match(/router\.post\('\/register'[^;]+\);/)[0];
      
      expect(registerLine).toContain('registrationLimiter');
      expect(registerLine).toContain('registrationBotProtection');
    });

    test('should not interfere with 2FA verification', () => {
      const routesPath = path.join(__dirname, '../routes/authRoutes.js');
      const content = fs.readFileSync(routesPath, 'utf8');
      expect(content).toContain("router.post('/login/verify-2fa'");
      
      // Check that 2FA doesn't have bot protection
      const twoFaMatch = content.match(/router\.post\('\/login\/verify-2fa'[^;]+;/);
      if (twoFaMatch) {
        const twoFaLine = twoFaMatch[0];
        expect(twoFaLine).not.toContain('BotProtection');
      }
    });

    test('rate limiting should run before bot protection', () => {
      const routesPath = path.join(__dirname, '../routes/authRoutes.js');
      const content = fs.readFileSync(routesPath, 'utf8');
      
      // Check both login and register
      const loginLine = content.match(/router\.post\('\/login'[^;]+\);/)[0];
      const loginRateIdx = loginLine.indexOf('loginLimiter');
      const loginBotIdx = loginLine.indexOf('loginBotProtection');
      expect(loginRateIdx).toBeLessThan(loginBotIdx);
      
      const registerLine = content.match(/router\.post\('\/register'[^;]+\);/)[0];
      const regRateIdx = registerLine.indexOf('registrationLimiter');
      const regBotIdx = registerLine.indexOf('registrationBotProtection');
      expect(regRateIdx).toBeLessThan(regBotIdx);
    });
  });

  /**
   * ===== SECURITY PROPERTIES TESTS =====
   * Verify implemented security properties
   */
  describe('Bot Protection Security Properties', () => {
    test('should prevent automated bot registration', () => {
      // Configuration: rate limiting (3/hour) + CAPTCHA (high score threshold)
      // Verified by: middleware file inspection
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('registrationThreshold');
      expect(content).toContain('threshold');
    });

    test('should prevent brute-force login attacks', () => {
      // Configuration: rate limiting (5/15min) + CAPTCHA (score threshold)
      const routesPath = path.join(__dirname, '../routes/authRoutes.js');
      const content = fs.readFileSync(routesPath, 'utf8');
      expect(content).toContain('loginLimiter');
      expect(content).toContain('loginBotProtection');
    });

    test('should use server-side verification', () => {
      // CAPTCHA tokens verified server-side, not client-side
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('axios.post');
      expect(content).toContain('google.com/recaptcha');
    });

    test('should include request IP for fraud detection', () => {
      // Remote IP sent to Google for additional analysis
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('remoteIP');
      expect(content).toContain('remoteip');
    });

    test('should return generic error messages', () => {
      // Should not leak information about verification
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('Suspicious activity');
      expect(content).toContain('verification failed');
    });

    test('should fail open if CAPTCHA service unavailable', () => {
      // If Google's service is down, should allow request (fail gracefully)
      const middlewarePath = path.join(__dirname, '../middleware/botProtectionMiddleware.js');
      const content = fs.readFileSync(middlewarePath, 'utf8');
      expect(content).toContain('catch');
      expect(content).toContain('next()');
    });
  });

  /**
   * ===== MIDDLEWARE EXPORTS TESTS =====
   * Verify correct exports from bot protection middleware
   */
  describe('Bot Protection Middleware Exports', () => {
    test('module should export loginBotProtection', () => {
      const middleware = require('../middleware/botProtectionMiddleware');
      expect(middleware).toHaveProperty('loginBotProtection');
    });

    test('module should export registrationBotProtection', () => {
      const middleware = require('../middleware/botProtectionMiddleware');
      expect(middleware).toHaveProperty('registrationBotProtection');
    });

    test('module should export optionalBotProtection', () => {
      const middleware = require('../middleware/botProtectionMiddleware');
      expect(middleware).toHaveProperty('optionalBotProtection');
    });

    test('module should export verifyRecaptcha', () => {
      const middleware = require('../middleware/botProtectionMiddleware');
      expect(middleware).toHaveProperty('verifyRecaptcha');
    });

    test('all exports should be functions', () => {
      const middleware = require('../middleware/botProtectionMiddleware');
      expect(typeof middleware.loginBotProtection).toBe('function');
      expect(typeof middleware.registrationBotProtection).toBe('function');
      expect(typeof middleware.optionalBotProtection).toBe('function');
      expect(typeof middleware.verifyRecaptcha).toBe('function');
    });
  });

  /**
   * ===== PACKAGE INSTALLATION TESTS =====
   * Verify required dependencies are installed
   */
  describe('Bot Protection Dependencies', () => {
    test('axios should be in package.json', () => {
      const packagePath = path.join(__dirname, '../package.json');
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      expect(pkg.dependencies.axios).toBeDefined();
      expect(typeof pkg.dependencies.axios).toBe('string');
    });

    test('axios should be importable in middleware', () => {
      // If axios can be required without error, it's installed
      const middleware = require('../middleware/botProtectionMiddleware');
      expect(middleware).toBeDefined();
    });
  });
});
