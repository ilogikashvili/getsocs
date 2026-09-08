const rateLimit = require('express-rate-limit');

// In automated tests, many requests get fired back-to-back from the same IP
// on purpose (that's how you exercise registration/login flows repeatedly).
// Real rate limiting is already covered by tests/rateLimiting.test.js against
// these exact limiter configs; skipping enforcement here just stops it from
// producing false-positive 429s in unrelated tests (auth, products, reviews,
// etc.) that happen to register/login more than a few times per run.
const IS_TEST_ENV = process.env.NODE_ENV === 'test';
const FIFTEEN_MINUTES = 15 * 60 * 1000;

function makeLimiter({ envName, max, message }) {
  return rateLimit({
    windowMs: FIFTEEN_MINUTES,
    max: Number(process.env[envName] || max),
    skip: (req, res) => IS_TEST_ENV,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      success: false,
      error: message
    },
    handler: (req, res, next, options) => res.status(429).json({
      success: false,
      error: options.message.error,
      retryAfter: Math.ceil(options.windowMs / 1000)
    })
  });
}

/**
 * Login Rate Limiter
 * Prevents brute-force attacks by limiting login attempts
 * 
 * Configuration:
 * - 50 attempts per 15 minutes per IP address
 * - Response includes Retry-After header
 * - IP forwarded through X-Forwarded-For (for proxy support)
 */
const loginLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,  // 15-minute window
  max: Number(process.env.LOGIN_RATE_LIMIT_MAX || 50),
  message: {
    success: false,
    error: 'Too many login attempts. Please try again in 15 minutes.',
    retryAfter: 15 * 60
  },
  standardHeaders: true,      // Include RateLimit-* headers
  legacyHeaders: false,       // Disable X-RateLimit-* headers
  skip: (req, res) => IS_TEST_ENV,  // Don't skip any requests (except in automated tests)
  // express-rate-limit v8's handler signature is (req, res, next, options) -
  // note "next" comes BEFORE "options". The previous 3-arg version of this
  // handler ((req, res, options) => ...) silently received the `next`
  // function in place of `options`, so `options.message.error` was actually
  // `next.message.error` - reading .error off undefined, throwing on every
  // single rate-limit hit. Because express-rate-limit invokes this handler
  // from inside an async function, that throw became an unhandled promise
  // rejection, which crashes the whole Node process on modern Node versions
  // (hence the repeated pm2 restarts).
  handler: (req, res, next, options) => {
    // Custom error response when rate limit is exceeded
    res.status(429).json({
      success: false,
      error: options.message.error,
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

/**
 * Password Reset Rate Limiter
 * Prevents brute-force token guessing by limiting reset attempts
 * 
 * Configuration:
 * - 25 attempts per 15 minutes per IP address
 */
const passwordResetLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,   // 15-minute window
  max: Number(process.env.PASSWORD_RESET_RATE_LIMIT_MAX || 25),
  skip: (req, res) => IS_TEST_ENV,
  message: {
    success: false,
    error: 'Too many password reset attempts. Please try again in 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json({
      success: false,
      error: 'Too many password reset attempts. Please try again in 15 minutes.',
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

/**
 * Registration Rate Limiter
 * Prevents spam registration by limiting attempts per IP
 * 
 * Configuration:
 * - 25 registrations per 15 minutes per IP
 */
const registrationLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,    // 15-minute window
  max: Number(process.env.REGISTRATION_RATE_LIMIT_MAX || 25),
  skip: (req, res) => IS_TEST_ENV,
  message: {
    success: false,
    error: 'Too many registration attempts. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(429).json({
      success: false,
      error: 'Too many registration attempts. Please try again later.',
      retryAfter: Math.ceil(options.windowMs / 1000)
    });
  }
});

/**
 * General API Rate Limiter
 * Applies moderate rate limiting to general API endpoints
 * 
 * Configuration:
 * - 2500 requests per 15 minutes per IP by default (override with GENERAL_RATE_LIMIT_MAX)
 */
const generalLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,    // 15-minute window
  max: Number(process.env.GENERAL_RATE_LIMIT_MAX || 2500),
  skip: (req, res) => IS_TEST_ENV,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests. Please try again shortly.'
  },
  handler: (req, res, next, options) => res.status(429).json({
    success: false,
    error: options.message.error,
    retryAfter: Math.ceil(options.windowMs / 1000)
  })
});

const productSearchLimiter = makeLimiter({
  envName: 'PRODUCT_SEARCH_RATE_LIMIT_MAX',
  max: 1000,
  message: 'Too many product searches. Please try again shortly.'
});

const productDetailLimiter = makeLimiter({
  envName: 'PRODUCT_DETAIL_RATE_LIMIT_MAX',
  max: 2500,
  message: 'Too many product detail requests. Please try again shortly.'
});

const listingWriteLimiter = makeLimiter({
  envName: 'LISTING_WRITE_RATE_LIMIT_MAX',
  max: 300,
  message: 'Too many listing changes. Please try again shortly.'
});

const imageUploadLimiter = makeLimiter({
  envName: 'IMAGE_UPLOAD_RATE_LIMIT_MAX',
  max: 250,
  message: 'Too many image uploads. Please try again shortly.'
});

const chatLimiter = makeLimiter({
  envName: 'CHAT_RATE_LIMIT_MAX',
  max: 1500,
  message: 'Too many chat requests. Please try again shortly.'
});

const paymentLimiter = makeLimiter({
  envName: 'PAYMENT_RATE_LIMIT_MAX',
  max: 150,
  message: 'Too many checkout requests. Please try again shortly.'
});



/**
 * Verification-code limiter for 6-digit 2FA/email codes. The login/resend
 * endpoints have their own limits, but the code-consumption endpoints also
 * need a brute-force ceiling because the code space is intentionally small.
 */
const verificationCodeLimiter = rateLimit({
  windowMs: FIFTEEN_MINUTES,
  max: 10,
  skip: (req, res) => IS_TEST_ENV,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many verification attempts. Please try again later.' },
  handler: (req, res, next, options) => res.status(429).json({
    success: false,
    error: options.message.error,
    retryAfter: Math.ceil(options.windowMs / 1000)
  })
});

/**
 * Internal metrics limiter. Metrics endpoints perform dependency health and
 * aggregation work, so even authenticated scrapers should not be allowed to
 * hammer them accidentally. 120/minute comfortably supports normal 15-60s
 * Prometheus scrape intervals.
 */
const metricsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  skip: (req, res) => IS_TEST_ENV,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many metrics requests.' }
});

module.exports = {
  loginLimiter,
  passwordResetLimiter,
  registrationLimiter,
  generalLimiter,
  productSearchLimiter,
  productDetailLimiter,
  listingWriteLimiter,
  imageUploadLimiter,
  chatLimiter,
  paymentLimiter,
  metricsLimiter,
  verificationCodeLimiter
};
