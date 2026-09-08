import React, { useContext, useState } from 'react';
import AuthContext from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { validatePassword } from '../utils/validation';
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
  BackArrowIcon
} from './authShared';

export default function Register() {
  const { register, completeEmailVerification, resendEmailVerificationCode } = useContext(AuthContext);
  const [form, setForm] = useState({ username: '', name: '', lastname: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [agree, setAgree] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [error, setError] = useState('');
  const nav = useNavigate();

  // Email verification step, shown after the registration form is submitted
  // successfully. The account exists but is unusable until this code is
  // confirmed - that's what actually completes registration.
  const [pendingEmail, setPendingEmail] = useState(null);
  const [code, setCode] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');

  function setField(key) {
    return e => setForm({ ...form, [key]: e.target.value });
  }

  async function submit(e) {
    e.preventDefault();
    if (!agree) {
      setError('You must accept the policy before registering.');
      return;
    }
    const validation = validatePassword(form.password);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    const fd = new FormData();
    Object.keys(form).forEach(k => fd.append(k, form[k]));
    const res = await register(fd);
    if (res.ok) {
      nav('/');
    } else if (res.requiresEmailVerification) {
      setPendingEmail(res.email);
      setError('');
    } else {
      setError(res.error || 'Register failed.');
    }
  }

  async function submitCode(e) {
    e.preventDefault();
    setVerifying(true);
    setVerifyError('');
    const res = await completeEmailVerification(pendingEmail, code.trim());
    setVerifying(false);
    if (res.ok) {
      nav('/');
    } else {
      setVerifyError(res.error || 'Verification failed.');
    }
  }

  async function handleResend() {
    setResending(true);
    setResendMsg('');
    const res = await resendEmailVerificationCode(pendingEmail);
    setResending(false);
    setResendMsg(res.ok ? 'A new code has been sent to your email.' : (res.error || 'Failed to resend code.'));
  }

  if (pendingEmail) {
    return (
      <AuthShell>
        <div className="auth-card">
          <AuthIconBadge><MailSendIcon /></AuthIconBadge>
          <h1 className="auth-card-title">Verify your email</h1>
          <p className="auth-card-subtitle">
            We sent a 6-digit code to <strong>{pendingEmail}</strong>. Enter it below to finish creating your account.
          </p>

          <form onSubmit={submitCode}>
            {verifyError && <div className="auth-alert">{verifyError}</div>}
            {resendMsg && <div className="auth-alert auth-alert-success">{resendMsg}</div>}

            <AuthField
              label="Verification code"
              icon={<LockIcon />}
              placeholder="000000"
              maxLength={6}
              value={code}
              onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
              required
              autoFocus
            />

            <button type="submit" className="auth-submit-btn" disabled={verifying || code.length !== 6}>
              {verifying ? 'Verifying…' : <>Verify &amp; create account <ArrowRightIcon /></>}
            </button>
          </form>

          <button type="button" className="auth-link-btn" onClick={handleResend} disabled={resending} style={{ display: 'block', margin: '16px auto 0' }}>
            {resending ? 'Sending…' : "Didn't get a code? Resend"}
          </button>

          <Link to="/login" className="auth-back-link">
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
        <h1 className="auth-card-title">Create your account</h1>
        <p className="auth-card-subtitle">Join us and start trading securely</p>

        <form onSubmit={submit}>
          {error && <div className="auth-alert">{error}</div>}

          <AuthField
            label="Username"
            icon={<PersonIcon />}
            name="username"
            placeholder="Choose a username"
            value={form.username}
            onChange={setField('username')}
            required
          />

          <div className="auth-field-pair">
            <AuthField
              label="First name"
              icon={<PersonIcon />}
              name="name"
              placeholder="First name"
              value={form.name}
              onChange={setField('name')}
              required
            />
            <AuthField
              label="Last name"
              icon={<PersonIcon />}
              name="lastname"
              placeholder="Last name"
              value={form.lastname}
              onChange={setField('lastname')}
              required
            />
          </div>

          <AuthField
            label="Email"
            icon={<MailIcon />}
            name="email"
            type="email"
            placeholder="Enter your email"
            value={form.email}
            onChange={setField('email')}
            required
          />
          <p className="auth-hint-text">
            One account per email address. We'll send a verification code here.
          </p>

          <AuthField
            label="Password"
            icon={<LockIcon />}
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create a password"
            value={form.password}
            onChange={setField('password')}
            required
            suffix={(
              <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide entered value' : 'Show entered value'}>
                <EyeIcon off={showPassword} />
              </button>
            )}
          />
          <p className="auth-hint-text">
            Must be at least 8 characters with an uppercase letter, a number, and a symbol.
          </p>

          <label className="auth-checkbox auth-policy-row">
            <input type="checkbox" checked={agree} onChange={e => setAgree(e.target.checked)} />
            <span>
              I agree to the{' '}
              <button type="button" className="auth-link-btn" onClick={() => setShowPolicy(true)}>marketplace policy</button>
            </span>
          </label>

          <button type="submit" className="auth-submit-btn">
            Create account <ArrowRightIcon />
          </button>
        </form>

        <p className="auth-bottom-text">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>

      {showPolicy && (
        <div className="modal-backdrop" onClick={() => setShowPolicy(false)}>
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <h4>Policy</h4>
            <p>By registering you confirm your details are correct. Follow our marketplace rules and be honest about listings.</p>
            <p>Buyers and sellers should use escrow for secure delivery of money and credentials.</p>
            <p>Off-platform contact info in listings is not allowed, and accounts must be ownership-verified before selling. <Link to="/policy" target="_blank" rel="noopener noreferrer">Read the full policy</Link>.</p>
            <button className="btn btn-secondary" type="button" onClick={() => setShowPolicy(false)}>Close</button>
          </div>
        </div>
      )}
    </AuthShell>
  );
}
