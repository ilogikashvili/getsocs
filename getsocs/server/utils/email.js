const nodemailer = require('nodemailer');
const logger = require('./logger');
const { CircuitBreaker } = require('./circuitBreaker');

const smtpBreaker = new CircuitBreaker('smtp', { failureThreshold: 4, resetTimeoutMs: 60_000 });

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM;

// Without these, an unreachable/misconfigured SMTP host makes nodemailer hang
// on the OS-level TCP timeout (can be 60s+) before failing. That hang is what
// eventually shows up client-side as a connection reset once a browser or
// proxy gives up waiting on the response. Fail fast instead.
const CONNECTION_TIMEOUT_MS = Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 8000);

function createTransport() {
  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: CONNECTION_TIMEOUT_MS,
    greetingTimeout: CONNECTION_TIMEOUT_MS,
    socketTimeout: CONNECTION_TIMEOUT_MS,
  });
}

async function sendEmail(to, subject, text, html) {
  // No SMTP configured (common in local/dev setups) - don't attempt a
  // connection that's guaranteed to fail or hang. Log and resolve instead so
  // callers (e.g. login/register) don't block or crash the request.
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
    logger.warn('SMTP not configured; email skipped', { email: to, subject });
    return { skipped: true, reason: 'SMTP not configured' };
  }

  // SMTP providers occasionally hiccup on a single connection attempt
  // (transient DNS blip, greeting timeout, momentary rate limit) - retrying
  // once after a short delay clears the large majority of these without the
  // caller (e.g. login) ever seeing a failure. Only the second attempt's
  // error is surfaced.
  const MAX_ATTEMPTS = 2;
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const transporter = createTransport();
    try {
      logger.info('Sending email', { email: to, attempt, maxAttempts: MAX_ATTEMPTS });
      const result = await smtpBreaker.execute(() => transporter.sendMail({
        from: EMAIL_FROM,
        to,
        subject,
        text,
        html,
      }));
      logger.info('Email sent', { email: to, messageId: result?.messageId });
      return result;
    } catch (error) {
      lastError = error;
      logger.error('Email delivery attempt failed', { email: to, attempt, maxAttempts: MAX_ATTEMPTS, error });
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    } finally {
      try { transporter.close(); } catch (e) {}
    }
  }
  throw lastError;
}

async function sendVerificationCode(email, code) {
  const subject = 'Your Getsocs verification code';
  const text = `Your verification code is ${code}. It expires in 15 minutes.`;
  const html = `<p>Your verification code is <strong>${code}</strong>.</p><p>This code expires in 15 minutes.</p>`;
  return sendEmail(email, subject, text, html);
}

module.exports = { sendEmail, sendVerificationCode };
