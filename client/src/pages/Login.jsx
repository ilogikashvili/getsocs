import React, { useContext, useState } from 'react';
import AuthContext from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import {
  AuthShell,
  AuthIconBadge,
  AuthField,
  ShieldLockIcon,
  MailSendIcon,
  PersonIcon,
  MailIcon,
  LockIcon,
  EyeIcon,
  ArrowRightIcon,
  SendIcon,
  BackArrowIcon
} from './authShared';

export default function Login() {
  const { login, completeTwoFactor, completeEmailVerification, resendEmailVerificationCode } = useContext(AuthContext);
  const [form, setForm] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // Two-factor verification step
  const [pendingUserId, setPendingUserId] = useState(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorMsg, setTwoFactorMsg] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Unverified-account step: login() refuses accounts that never finished
  // email verification at registration, so give them a way to finish it here.
  const [pendingEmailVerify, setPendingEmailVerify] = useState(null);
  const [emailCode, setEmailCode] = useState('');
  const [emailVerifyError, setEmailVerifyError] = useState('');
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [resending, setResending] = useState(false);

  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    const res = await login(form.username, form.password);
    if (res.ok) {
      nav('/');
    } else if (res.requires2FA) {
      setPendingUserId(res.userId);
      setTwoFactorMsg(res.message || 'A 6-digit code has been sent to your email.');
    } else if (res.requiresEmailVerification) {
      setPendingEmailVerify(res.email);
    } else {
      setError(res.error || 'Login failed.');
    }
  }

  async function submitEmailVerify(e) {
    e.preventDefault();
    setEmailVerifying(true);
    setEmailVerifyError('');
    const res = await completeEmailVerification(pendingEmailVerify, emailCode.trim());
    setEmailVerifying(false);
    if (res.ok) {
      nav('/');
    } else {
      setEmailVerifyError(res.error || 'Verification failed.');
    }
  }

  async function handleResendEmailCode() {
    setResending(true);
    setResendMsg('');
    const res = await resendEmailVerificationCode(pendingEmailVerify);
    setResending(false);
    setResendMsg(res.ok ? 'A new code has been sent to your email.' : (res.error || 'Failed to resend code.'));
  }

  async function submitTwoFactor(e) {
    e.preventDefault();
    setVerifying(true);
    setTwoFactorMsg('');
    const res = await completeTwoFactor(pendingUserId, twoFactorCode.trim());
    setVerifying(false);
    if (res.ok) {
      nav('/');
    } else {
      setTwoFactorMsg(res.error || 'Verification failed.');
    }
  }

  async function sendResetLink() {
    setForgotSending(true);
    setForgotMsg('');
    try {
      const { requestPasswordReset } = await import('../services/authService');
      await requestPasswordReset(forgotEmail);
      setForgotSent(true);
    } catch (err) {
      setForgotMsg('Unable to request reset right now.');
    } finally {
      setForgotSending(false);
    }
  }

  function openForgot() {
    setForgotOpen(true);
    setForgotSent(false);
    setForgotMsg('');
    setForgotEmail(form.username);
  }

  if (pendingEmailVerify) {
    return (
      <AuthShell>
        <div className="auth-card">
          <AuthIconBadge><MailSendIcon /></AuthIconBadge>
          <h1 className="auth-card-title">Verify your email</h1>
          <p className="auth-card-subtitle">
            Your account needs email verification before you can sign in. Enter the code sent to <strong>{pendingEmailVerify}</strong>.
          </p>

          <form onSubmit={submitEmailVerify}>
            {emailVerifyError && <div className="auth-alert">{emailVerifyError}</div>}
            {resendMsg && <div className="auth-alert auth-alert-success">{resendMsg}</div>}
            <AuthField
              label="Verification code"
              icon={<LockIcon />}
              placeholder="000000"
              maxLength={6}
              value={emailCode}
              onChange={e => setEmailCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />
            <button type="submit" className="auth-submit-btn" disabled={emailVerifying || emailCode.length !== 6}>
              {emailVerifying ? 'Verifying…' : <>Verify &amp; sign in <ArrowRightIcon /></>}
            </button>
          </form>

          <button type="button" className="auth-link-btn" onClick={handleResendEmailCode} disabled={resending} style={{ display: 'block', margin: '16px auto 0' }}>
            {resending ? 'Sending…' : "Didn't get a code? Resend"}
          </button>

          <Link to="#" className="auth-back-link" onClick={e => { e.preventDefault(); setPendingEmailVerify(null); }}>
            <BackArrowIcon /> Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (pendingUserId) {
    return (
      <AuthShell>
        <div className="auth-card">
          <AuthIconBadge><ShieldLockIcon /></AuthIconBadge>
          <h1 className="auth-card-title">Verify your identity</h1>
          <p className="auth-card-subtitle">Enter the 6-digit code we sent to your email.</p>

          <form onSubmit={submitTwoFactor}>
            {twoFactorMsg && <div className="auth-alert">{twoFactorMsg}</div>}
            <AuthField
              label="Verification code"
              icon={<LockIcon />}
              name="twoFactorCode"
              placeholder="000000"
              maxLength={6}
              value={twoFactorCode}
              onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />
            <button type="submit" className="auth-submit-btn" disabled={verifying || twoFactorCode.length !== 6}>
              {verifying ? 'Verifying…' : <>Verify &amp; sign in <ArrowRightIcon /></>}
            </button>
          </form>

          <Link to="#" className="auth-back-link" onClick={e => { e.preventDefault(); setPendingUserId(null); }}>
            <BackArrowIcon /> Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  if (forgotOpen) {
    return (
      <AuthShell>
        <div className="auth-card">
          <AuthIconBadge><MailSendIcon /></AuthIconBadge>
          <h1 className="auth-card-title">Forgot your password?</h1>
          <p className="auth-card-subtitle">
            No worries! Enter your email or username and we&rsquo;ll send you a link to reset your password.
          </p>

          {forgotSent ? (
            <div className="auth-alert auth-alert-success">
              If that email exists, a reset code has been sent. Check your inbox, then{' '}
              <Link to="/reset-password">enter your code here</Link>.
            </div>
          ) : (
            <form onSubmit={e => { e.preventDefault(); sendResetLink(); }}>
              {forgotMsg && <div className="auth-alert">{forgotMsg}</div>}
              <AuthField
                label="Email or username"
                icon={<MailIcon />}
                type="text"
                placeholder="Enter your email or username"
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                required
                autoFocus
              />
              <button type="submit" className="auth-submit-btn" disabled={forgotSending || !forgotEmail}>
                {forgotSending ? 'Sending…' : <>Send reset link <SendIcon /></>}
              </button>
            </form>
          )}

          <div className="auth-info-card">
            <span className="auth-info-icon"><LockIcon /></span>
            <div>
              <strong>Security first</strong>
              <p>We&rsquo;ll never share your information with anyone. Your data is always safe with us.</p>
            </div>
          </div>

          <Link to="#" className="auth-back-link" onClick={e => { e.preventDefault(); setForgotOpen(false); }}>
            <BackArrowIcon /> Back to sign in
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <AuthIconBadge><ShieldLockIcon /></AuthIconBadge>
        <h1 className="auth-card-title">Welcome back</h1>
        <p className="auth-card-subtitle">Sign in to your account</p>

        <form onSubmit={submit}>
          {error && <div className="auth-alert">{error}</div>}

          <AuthField
            label="Username or email"
            icon={<PersonIcon />}
            name="username"
            placeholder="Enter your username or email"
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            required
          />

          <AuthField
            label="Password"
            icon={<LockIcon />}
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
            required
            suffix={(
              <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                <EyeIcon off={showPassword} />
              </button>
            )}
          />

          <div className="auth-row-between">
            <label className="auth-checkbox">
              <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
              <span>Remember me</span>
            </label>
            <button type="button" className="auth-link-btn" onClick={openForgot}>Forgot password?</button>
          </div>

          <button type="submit" className="auth-submit-btn">
            Sign In <ArrowRightIcon />
          </button>
        </form>

        <p className="auth-bottom-text">
          Don&rsquo;t have an account? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </AuthShell>
  );
}
