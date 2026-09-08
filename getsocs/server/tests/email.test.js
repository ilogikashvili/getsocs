const mockSendMail = jest.fn();
const mockClose = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail, close: mockClose }));

jest.mock('nodemailer', () => ({ createTransport: mockCreateTransport }));
jest.mock('../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

function loadEmailWithEnv(env = {}) {
  jest.resetModules();
  jest.doMock('nodemailer', () => ({ createTransport: mockCreateTransport }));
  jest.doMock('../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }));

  delete process.env.SMTP_HOST;
  delete process.env.SMTP_PORT;
  delete process.env.SMTP_SECURE;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.EMAIL_FROM;
  delete process.env.SMTP_CONNECTION_TIMEOUT_MS;
  Object.assign(process.env, env);

  return require('../utils/email');
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
});

describe('email utility', () => {
  test('skips delivery when SMTP is not configured', async () => {
    const { sendVerificationCode } = loadEmailWithEnv();

    const result = await sendVerificationCode('user@example.com', '123456');

    expect(result).toEqual({ skipped: true, reason: 'SMTP not configured' });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('sends verification email through configured SMTP transport', async () => {
    const { sendVerificationCode } = loadEmailWithEnv({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      SMTP_SECURE: 'true',
      SMTP_USER: 'smtp-user',
      SMTP_PASS: 'smtp-pass',
      EMAIL_FROM: 'Getsocs <noreply@example.com>',
      SMTP_CONNECTION_TIMEOUT_MS: '1234',
    });

    const result = await sendVerificationCode('user@example.com', '654321');

    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 465,
      secure: true,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-pass',
      },
      connectionTimeout: 1234,
      greetingTimeout: 1234,
      socketTimeout: 1234,
    });
    expect(mockSendMail).toHaveBeenCalledWith({
      from: 'Getsocs <noreply@example.com>',
      to: 'user@example.com',
      subject: 'Your Getsocs verification code',
      text: 'Your verification code is 654321. It expires in 15 minutes.',
      html: '<p>Your verification code is <strong>654321</strong>.</p><p>This code expires in 15 minutes.</p>',
    });
    expect(mockClose).toHaveBeenCalled();
    expect(result).toEqual({ messageId: 'test-message-id' });
  });
});
