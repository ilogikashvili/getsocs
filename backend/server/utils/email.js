const nodemailer = require('nodemailer');

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
    console.warn(`[email] SMTP not configured - skipping send to ${to}. Subject: "${subject}"`);
    return { skipped: true, reason: 'SMTP not configured' };
  }

  const transporter = createTransport();

  try {
    console.log(`Sending email to ${to} from ${EMAIL_FROM}...`);
    const result = await transporter.sendMail({
      from: EMAIL_FROM,
      to,
      subject,
      text,
      html,
    });
    console.log(`Email sent successfully:`, result);
    return result;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message || error);
    throw error;
  }
}

async function sendVerificationCode(email, code) {
  const subject = 'Your Getsocs verification code';
  const text = `Your verification code is ${code}. It expires in 15 minutes.`;
  const html = `<p>Your verification code is <strong>${code}</strong>.</p><p>This code expires in 15 minutes.</p>`;
  const result = await sendEmail(email, subject, text, html);
  if (result && result.skipped) {
    // Dev/sandbox convenience: with no SMTP configured there's no other way
    // to retrieve the code, so surface it in the server logs instead of
    // leaving the login/register flow stuck with no way to proceed.
    console.log(`[email] Verification code for ${email}: ${code}`);
  }
  return result;
}

module.exports = { sendEmail, sendVerificationCode };
