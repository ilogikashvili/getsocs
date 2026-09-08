import React, { useContext } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/', icon: 'home', end: true },
  { label: 'Marketplace', to: '/products', icon: 'market' },
  { label: 'My Listings', to: '/upload', icon: 'list' },
  { label: 'Favorites', to: '/favorites', icon: 'heart' },
  { label: 'Orders', to: '/orders', icon: 'orders' }
];

const QUICK_LINKS = [
  { label: 'Instagram', key: 'instagram', image: '/platform-instagram-clean.png' },
  { label: 'Telegram', key: 'telegram', image: '/platform-telegram-clean.png' },
  { label: 'YouTube', key: 'youtube', image: '/platform-youtube-clean.png' },
  { label: 'TikTok', key: 'tiktok', image: '/platform-tiktok-clean.png' },
  { label: 'Twitter', key: 'twitter', icon: 'twitter' },
  { label: 'Facebook', key: 'facebook', icon: 'facebook' }
];

function QuickLinkIcon({ name }) {
  const common = { width: 14, height: 14, viewBox: '0 0 24 24', 'aria-hidden': 'true' };
  if (name === 'twitter') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M22 5.9c-.7.3-1.5.6-2.3.7.8-.5 1.5-1.3 1.8-2.3-.8.5-1.7.8-2.6 1a4.1 4.1 0 0 0-7 3.7A11.6 11.6 0 0 1 3.4 4.6a4.1 4.1 0 0 0 1.3 5.5c-.7 0-1.3-.2-1.9-.5v.1a4.1 4.1 0 0 0 3.3 4 4.2 4.2 0 0 1-1.8.1 4.1 4.1 0 0 0 3.8 2.9A8.3 8.3 0 0 1 2 18.4a11.6 11.6 0 0 0 6.3 1.8c7.5 0 11.7-6.3 11.7-11.7v-.5c.8-.6 1.5-1.3 2-2.1Z" />
      </svg>
    );
  }
  if (name === 'facebook') {
    return (
      <svg {...common} fill="currentColor">
        <path d="M13.5 21v-7.6h2.6l.4-3h-3V8.3c0-.9.2-1.5 1.6-1.5h1.5V4.2c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.5H8v3h2.7V21h2.8Z" />
      </svg>
    );
  }
  return null;
}

function SideIcon({ name }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': 'true'
  };

  const paths = {
    home: <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
    market: <path d="M5 6h14l-1.3 6.8H7L5 6Zm3 11.5h9M9 20h.1M16 20h.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    list: <path d="M8 6h11M8 12h11M8 18h11M4 6h.1M4 12h.1M4 18h.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
    message: <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6A2.5 2.5 0 0 1 16.5 15H10l-5 4V6.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
    heart: <path d="M20 8.8c0 5-8 10.2-8 10.2S4 13.8 4 8.8A4.2 4.2 0 0 1 11.7 6 4.2 4.2 0 0 1 20 8.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
    orders: <path d="M7 4h10v16H7V4Zm3 4h4M10 12h4M10 16h2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    settings: (
      <>
        <path d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4Z" stroke="currentColor" strokeWidth="1.7" />
        <path d="m19 13 .8 1.9-1.8 3.1-2-.2a8 8 0 0 1-1.6.9L13.2 21H9.8l-.8-2.3a8 8 0 0 1-1.6-.9l-2 .2-1.8-3.1.8-1.9a8 8 0 0 1 0-2L3.6 9.1 5.4 6l2 .2A8 8 0 0 1 9 5.3L9.8 3h3.4l.8 2.3a8 8 0 0 1 1.6.9l2-.2 1.8 3.1-.8 1.9a8 8 0 0 1 0 2Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
      </>
    )
  };

  return <svg {...common}>{paths[name]}</svg>;
}

export default function Sidebar({ collapsed = false, mobileOpen = false, viewport = 'desktop', onToggleCollapse, onClose }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const isAdminShell = user?.role === 'admin';
  const currentPlatform = new URLSearchParams(location.search).get('platform')?.toLowerCase() || '';

  if (isAdminShell) return null;

  const asideClass = [
    'sidebar',
    collapsed ? 'is-collapsed' : '',
    viewport === 'mobile' ? 'is-drawer' : '',
    mobileOpen ? 'is-open' : ''
  ].filter(Boolean).join(' ');

  function handleNavClick() {
    if (viewport === 'mobile' && onClose) onClose();
  }

  return (
    <aside className={asideClass}>
      <div className="sidebar-brand-row">
        <Link className="sidebar-brand" to="/" aria-label="Getsocs home" onClick={handleNavClick}>
          <img src="/getsocs-logo.png" alt="GS" />
          <span>
            <strong>GETSOCS</strong>
            <small>Trusted social account marketplace</small>
          </span>
        </Link>
        {viewport === 'mobile' ? (
          <button type="button" className="sidebar-close" onClick={onClose} aria-label="Close menu">
            <CloseIcon />
          </button>
        ) : (
          <button
            type="button"
            className="sidebar-toggle"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CollapseIcon flipped={collapsed} />
          </button>
        )}
      </div>

      <nav className="side-menu" aria-label="Marketplace navigation">
        {NAV_ITEMS.map(item => (
          <NavLink
            key={item.label}
            to={item.to}
            end={item.end}
            onClick={handleNavClick}
            title={item.label}
            className={({ isActive }) => `side-link ${isActive && !item.suppressActive ? 'active' : ''}`}
          >
            <SideIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-divider" />

      <section className="quick-links" aria-label="Quick links">
        <h2>Quick Links</h2>
        {QUICK_LINKS.map(link => (
          <Link
            key={link.key}
            className={`quick-link ${currentPlatform === link.key ? 'active' : ''}`}
            to={`/products?platform=${link.key}`}
            title={link.label}
            onClick={handleNavClick}
          >
            {link.image ? (
              <img src={link.image} alt="" />
            ) : (
              <span className="quick-link-icon"><QuickLinkIcon name={link.icon} /></span>
            )}
            <span>{link.label}</span>
          </Link>
        ))}
      </section>
    </aside>
  );
}

function CollapseIcon({ flipped }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ transform: flipped ? 'rotate(180deg)' : 'none' }}>
      <path d="M15 5 8 12l7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}
