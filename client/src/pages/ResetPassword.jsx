import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { resetPassword } from '../services/authService';
import { validatePassword } from '../utils/validation';
import {
  AuthShell,
  AuthIconBadge,
  AuthField,
  KeyBadgeIcon,
  ShieldLockIcon,
  KeyIcon,
  LockIcon,
  EyeIcon,
  ArrowRightIcon,
  BackArrowIcon
} from './authShared';

export default function ResetPassword() {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!/^[0-9]{6}$/.test(token.trim())) {
      setError('Reset code must be a 6-digit token.');
      return;
    }
    const validation = validatePassword(password);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await resetPassword(token.trim(), password);
      if (res.data.success) {
        setSuccess(true);
      } else {
        setError(res.data.error || 'Unable to reset password.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to reset password.');
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <AuthShell>
        <div className="auth-card">
          <AuthIconBadge><ShieldLockIcon /></AuthIconBadge>
          <h1 className="auth-card-title">Password updated</h1>
          <p className="auth-card-subtitle">Your password has been changed. You can now sign in with your new password.</p>
          <button className="auth-submit-btn" type="button" onClick={() => navigate('/login')}>
            Go to sign in <ArrowRightIcon />
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <div className="auth-card">
        <AuthIconBadge><KeyBadgeIcon /></AuthIconBadge>
        <h1 className="auth-card-title">Reset your password</h1>
        <p className="auth-card-subtitle">Paste the 6-digit reset code we emailed you, then choose a new password.</p>

        <form onSubmit={submit}>
          {error && <div className="auth-alert">{error}</div>}

          <AuthField
            label="Reset code"
            icon={<KeyIcon />}
            placeholder="000000"
            maxLength={6}
            value={token}
            onChange={e => setToken(e.target.value.replace(/\D/g, ''))}
            required
          />

          <AuthField
            label="New password"
            icon={<LockIcon />}
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your new password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            suffix={(
              <button type="button" className="auth-eye-btn" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                <EyeIcon off={showPassword} />
              </button>
            )}
          />
          <p className="auth-hint-text">
            Must be at least 8 characters with an uppercase letter, a number, and a symbol.
          </p>

          <AuthField
            label="Confirm new password"
            icon={<LockIcon />}
            type={showPassword ? 'text' : 'password'}
            placeholder="Re-enter your new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? 'Saving…' : <>Reset password <ArrowRightIcon /></>}
          </button>
        </form>

        <Link to="/login" className="auth-back-link">
          <BackArrowIcon /> Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
