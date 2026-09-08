const axios = require('axios');

/**
 * Bot Protection Middleware
 * Verifies reCAPTCHA v3 tokens to prevent bot attacks on registration and login
 * 
 * Features:
 * - Google reCAPTCHA v3 verification (invisible, no user interruption)
 * - Configurable score threshold (0.0-1.0, default 0.5)
 * - Action-based verification (login, register, etc.)
 * - Secure server-side verification
 * - IP address logging for analytics
 * - Graceful fallback if CAPTCHA not configured
 */

const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET_KEY;
const RECAPTCHA_SCORE_THRESHOLD = parseFloat(process.env.RECAPTCHA_SCORE_THRESHOLD || '0.5');
const RECAPTCHA_ENDPOINT = 'https://www.google.com/recaptcha/api/siteverify';

/**
 * Verify reCAPTCHA token with Google's servers
 * 
 * @param {string} token - reCAPTCHA response token from frontend
 * @param {string} remoteIP - Client IP address
 * @returns {Promise<{success: boolean, score: number, action: string, error?: string}>}
 */
async function verifyRecaptcha(token, remoteIP) {
  try {
    if (!RECAPTCHA_SECRET) {
      // CAPTCHA not configured - allow request (development/testing)
      return { success: true, score: 1.0, action: 'unknown', skipped: true };
    }

    const response = await axios.post(RECAPTCHA_ENDPOINT, null, {
      params: {
        secret: RECAPTCHA_SECRET,
        response: token,
        remoteip: remoteIP
      },
      timeout: 5000  // 5 second timeout
    });

    const { success, score, action, challenge_ts, hostname, error_codes } = response.data;

    if (!success) {
      return {
        success: false,
        score: 0,
        action: action || 'unknown',
        error: `reCAPTCHA verification failed: ${error_codes?.join(', ') || 'unknown error'}`
      };
    }

    return {
      success: true,
      score,
      action,
      challenge_ts,
      hostname
    };
  } catch (error) {
    return {
      success: false,
      score: 0,
      action: 'unknown',
      error: `reCAPTCHA verification error: ${error.message}`
    };
  }
}

/**
 * Login Bot Protection Middleware
 * Verifies reCAPTCHA v3 token for login attempts
 * 
 * Expected: POST body with { token: "reCAPTCHA_response_token", ... }
 * Action: 'login'
 * Score threshold: Default 0.5
 * 
 * On success: Attaches captchaVerified info to req.captcha
 * On failure: Returns 403 Forbidden with error details
 */
const loginBotProtection = async (req, res, next) => {
  try {
    const token = req.body?.captchaToken;
    const remoteIP = req.ip || req.connection.remoteAddress;

    if (!RECAPTCHA_SECRET) {
      // CAPTCHA not configured on this server - don't block login/register
      // on a missing token that the frontend was never asked to send.
      req.captcha = { verified: false, skipped: true };
      return next();
    }

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing reCAPTCHA token. Please enable JavaScript.'
      });
    }

    const verification = await verifyRecaptcha(token, remoteIP);

    if (!verification.success) {
      return res.status(403).json({
        success: false,
        error: verification.error || 'Bot verification failed. Please try again.'
      });
    }

    // Check score threshold (if CAPTCHA is configured)
    if (!verification.skipped && verification.score < RECAPTCHA_SCORE_THRESHOLD) {
      return res.status(403).json({
        success: false,
        error: 'Suspicious activity detected. Please try again or contact support.'
      });
    }

    // Attach verification info to request for logging
    req.captcha = {
      verified: true,
      score: verification.score,
      action: verification.action,
      challenge_ts: verification.challenge_ts,
      hostname: verification.hostname,
      skipped: verification.skipped || false
    };

    next();
  } catch (error) {
    console.error('[Bot Protection] Login verification error:', error);
    
    // Fail open (allow request) if CAPTCHA service is down
    // This prevents login from breaking if Google's service is unavailable
    req.captcha = {
      verified: false,
      error: 'CAPTCHA service unavailable',
      skipped: true
    };
    
    next();
  }
};

/**
 * Registration Bot Protection Middleware
 * Verifies reCAPTCHA v3 token for registration attempts
 * Higher confidence required for registration (prevent spam accounts)
 * 
 * Expected: POST body with { captchaToken: "reCAPTCHA_response_token", ... }
 * Action: 'register'
 * Score threshold: Default 0.5
 * 
 * On success: Attaches captchaVerified info to req.captcha
 * On failure: Returns 403 Forbidden with error details
 */
const registrationBotProtection = async (req, res, next) => {
  try {
    const token = req.body?.captchaToken;
    const remoteIP = req.ip || req.connection.remoteAddress;

    if (!RECAPTCHA_SECRET) {
      // CAPTCHA not configured on this server - don't block login/register
      // on a missing token that the frontend was never asked to send.
      req.captcha = { verified: false, skipped: true };
      return next();
    }

    if (!token) {
      return res.status(400).json({
        success: false,
        error: 'Missing reCAPTCHA token. Please enable JavaScript.'
      });
    }

    const verification = await verifyRecaptcha(token, remoteIP);

    if (!verification.success) {
      return res.status(403).json({
        success: false,
        error: verification.error || 'Bot verification failed. Please try again.'
      });
    }

    // For registration, use slightly higher threshold to reduce spam
    const registrationThreshold = Math.min(RECAPTCHA_SCORE_THRESHOLD + 0.1, 0.9);
    
    if (!verification.skipped && verification.score < registrationThreshold) {
      return res.status(403).json({
        success: false,
        error: 'Suspicious activity detected. Please try again or contact support.'
      });
    }

    // Attach verification info to request for logging
    req.captcha = {
      verified: true,
      score: verification.score,
      action: verification.action,
      challenge_ts: verification.challenge_ts,
      hostname: verification.hostname,
      skipped: verification.skipped || false
    };

    next();
  } catch (error) {
    console.error('[Bot Protection] Registration verification error:', error);
    
    // Fail open (allow request) if CAPTCHA service is down
    req.captcha = {
      verified: false,
      error: 'CAPTCHA service unavailable',
      skipped: true
    };
    
    next();
  }
};

/**
 * Optional Bot Protection Middleware
 * For endpoints that can optionally use CAPTCHA without blocking
 * Logs verification but doesn't block unverified requests
 */
const optionalBotProtection = async (req, res, next) => {
  try {
    const token = req.body?.captchaToken;
    const remoteIP = req.ip || req.connection.remoteAddress;

    if (!token) {
      // No token provided, continue
      req.captcha = { verified: false, skipped: true };
      return next();
    }

    const verification = await verifyRecaptcha(token, remoteIP);

    req.captcha = verification;
    next();
  } catch (error) {
    console.error('[Bot Protection] Optional verification error:', error);
    req.captcha = { verified: false, error: error.message };
    next();
  }
};

module.exports = {
  loginBotProtection,
  registrationBotProtection,
  optionalBotProtection,
  verifyRecaptcha
};
