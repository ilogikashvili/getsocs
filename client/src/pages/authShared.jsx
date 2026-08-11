import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheckIcon, BadgeCheckIcon } from './marketplaceShared';

export function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="3.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M5 20c0-4 3.2-6.5 7-6.5s7 2.5 7 6.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="m4.5 7 7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 10.5V7.8a4 4 0 1 1 8 0v2.7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function KeyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="8" cy="15" r="4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M11 12 19.5 3.5M16.5 6.5 19 9M14 9l2 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function EyeIcon({ off = false }) {
  if (off) {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M9.9 5.4A10.6 10.6 0 0 1 12 5.2c5 0 8.7 3.2 10.3 6.8-.65 1.45-1.6 2.85-2.8 4.05M6.6 6.7C4.4 8.1 2.7 10 1.7 12c1.6 3.6 5.3 6.8 10.3 6.8 1.3 0 2.5-.2 3.6-.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.9 14.1a3.2 3.2 0 0 0 4.2-4.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M1.7 12C3.3 8.4 7 5.2 12 5.2s8.7 3.2 10.3 6.8c-1.6 3.6-5.3 6.8-10.3 6.8S3.3 15.6 1.7 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

export function ArrowRightIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h16M13 5l7 7-7 7" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m3 11 18-8-8 18-2.5-7.5L3 11Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

export function BackArrowIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M20 12H4M11 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function HeadsetIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 13v-1a8 8 0 0 1 16 0v1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <rect x="3" y="13" width="4.5" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="16.5" y="13" width="4.5" height="6" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <path d="M19.5 19.4c0 1.5-1.4 2.6-3.5 2.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.47c-.28 1.5-1.13 2.77-2.4 3.62v3h3.87c2.27-2.09 3.55-5.17 3.55-8.65Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.73-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.3a7.2 7.2 0 0 1 0-4.6v-3.1H1.28a12 12 0 0 0 0 10.8l3.99-3.1Z" />
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.6 4.6 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.6l3.99 3.1C6.22 6.86 8.87 4.75 12 4.75Z" />
    </svg>
  );
}

export function DiscordIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M19.5 6.2A16.5 16.5 0 0 0 15.4 5l-.3.6a13 13 0 0 1 3.6 1.4c-2-1-4.3-1.5-6.7-1.5s-4.7.5-6.7 1.5c.9-.6 2.3-1.1 3.6-1.4L8.6 5A16.5 16.5 0 0 0 4.5 6.2C2.3 9.4 1.7 12.5 1.9 15.6a16.6 16.6 0 0 0 5 2.6l.8-1.3a10.8 10.8 0 0 1-1.7-.8c.15-.1.3-.2.4-.3 3.3 1.5 6.9 1.5 10.2 0l.4.3c-.55.3-1.1.55-1.7.8l.8 1.3a16.5 16.5 0 0 0 5-2.6c.3-3.5-.6-6.6-2.6-9.4ZM8.9 13.9c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.2 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" fill="#5865F2" />
    </svg>
  );
}

export function TelegramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="#29B6F6" />
      <path d="m6.5 12.2 10-4.1c.5-.2.9.1.7.7l-1.7 8c-.1.5-.5.6-.9.4l-2.6-1.9-1.3 1.2c-.15.15-.27.27-.5.27l.2-2.5 4.6-4.2c.2-.2 0-.3-.2-.15l-5.7 3.6-2.4-.75c-.5-.15-.5-.5.1-.72Z" fill="#fff" />
    </svg>
  );
}

export function GithubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.7.5.9 5.3.9 11.6c0 5 3.2 9.2 7.7 10.7.6.1.8-.25.8-.57v-2c-3.13.68-3.8-1.34-3.8-1.34-.5-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.16 1.72 1.16 1 1.72 2.63 1.22 3.27.93.1-.73.4-1.22.7-1.5-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.1-2.98 0 0 .95-.3 3.1 1.16a10.7 10.7 0 0 1 5.66 0c2.16-1.46 3.1-1.16 3.1-1.16.6 1.55.23 2.7.1 2.98.72.8 1.16 1.8 1.16 3.03 0 4.33-2.63 5.28-5.14 5.56.4.35.77 1.03.77 2.1v3.1c0 .32.2.68.8.56 4.5-1.5 7.7-5.7 7.7-10.7C23.1 5.3 18.3.5 12 .5Z" />
    </svg>
  );
}

export function ShieldLockIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 2.5 20 6v5.5c0 5.2-3.4 8.6-8 10-4.6-1.4-8-4.8-8-10V6l8-3.5Z" fill="url(#authShieldFill)" stroke="url(#authShieldStroke)" strokeWidth="1.4" strokeLinejoin="round" />
      <rect x="8.6" y="11.3" width="6.8" height="5.2" rx="1.3" fill="#fff" fillOpacity=".92" />
      <path d="M10.2 11.3V9.6a1.8 1.8 0 1 1 3.6 0v1.7" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" />
      <defs>
        <linearGradient id="authShieldFill" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2fcaff" />
          <stop offset="0.5" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#df45ff" />
        </linearGradient>
        <linearGradient id="authShieldStroke" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7c5cff" />
          <stop offset="1" stopColor="#df45ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function MailSendIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="3" y="6" width="18" height="13" rx="3" fill="url(#authMailFill)" />
      <path d="m3.5 7.5 8.5 6.3 8.5-6.3" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="authMailFill" x1="3" y1="6" x2="21" y2="19" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2fcaff" />
          <stop offset="0.5" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#df45ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function KeyBadgeIcon() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="9.5" cy="14.5" r="4.6" fill="none" stroke="url(#authKeyStroke)" strokeWidth="1.8" />
      <path d="M12.8 11.2 20.5 3.5M17 7l2.5 2.5M14.5 9.5 16.7 11.7" stroke="url(#authKeyStroke)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="authKeyStroke" x1="4" y1="4" x2="21" y2="19" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2fcaff" />
          <stop offset="0.5" stopColor="#7c5cff" />
          <stop offset="1" stopColor="#df45ff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export const SOCIAL_PROVIDERS = [
  { key: 'google', label: 'Google', Icon: GoogleIcon },
  { key: 'discord', label: 'Discord', Icon: DiscordIcon },
  { key: 'telegram', label: 'Telegram', Icon: TelegramIcon },
  { key: 'github', label: 'GitHub', Icon: GithubIcon }
];

export function AuthShell({ children }) {
  return (
    <div className="auth-page-v2">
      <Link to="/" className="auth-brand-header">
        <span className="auth-brand-logo">GS</span>
        <span className="auth-brand-copy">
          <strong>GETSOCS</strong>
          <small>Trusted social account marketplace</small>
        </span>
      </Link>

      <div className="auth-card-wrap">{children}</div>

      <footer className="auth-trust-footer">
        <span><ShieldCheckIcon /> Escrow protected</span>
        <span><BadgeCheckIcon /> Verified listings</span>
        <span><HeadsetIcon /> 24/7 support</span>
      </footer>
    </div>
  );
}

export function AuthIconBadge({ children }) {
  return <div className="auth-icon-badge">{children}</div>;
}

export function AuthField({ label, icon, suffix, ...inputProps }) {
  return (
    <label className="auth-field">
      <span className="auth-field-label">{label}</span>
      <span className="auth-field-control">
        <span className="auth-field-icon">{icon}</span>
        <input {...inputProps} />
        {suffix && <span className="auth-field-suffix">{suffix}</span>}
      </span>
    </label>
  );
}

export function SocialRow({ note, onSelect }) {
  return (
    <div className="auth-social-block">
      <div className="auth-divider"><span>Or continue with</span></div>
      <div className="auth-social-row">
        {SOCIAL_PROVIDERS.map(({ key, label, Icon }) => (
          <button
            type="button"
            key={key}
            className="auth-social-btn"
            aria-label={label}
            title={label}
            onClick={() => onSelect(label)}
          >
            <Icon />
          </button>
        ))}
      </div>
      {note && <p className="auth-social-note">{note}</p>}
    </div>
  );
}
