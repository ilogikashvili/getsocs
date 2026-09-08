import React from 'react';
import { NavLink, Link } from 'react-router-dom';

function TabIcon({ name }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' };
  if (name === 'home') {
    return (
      <svg {...common}>
        <path d="M4 10.5 12 4l8 6.5V20h-5v-6H9v6H4v-9.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === 'market') {
    return (
      <svg {...common}>
        <path d="M5 6h14l-1.3 6.8H7L5 6Zm3 11.5h9M9 20h.1M16 20h.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === 'list') {
    return (
      <svg {...common}>
        <path d="M8 6h11M8 12h11M8 18h11M4 6h.1M4 12h.1M4 18h.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'profile') {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M5 20c1.2-4 4-6 7-6s5.8 2 7 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === 'plus') {
    return (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

const TABS = [
  { label: 'Home', to: '/', icon: 'home', end: true },
  { label: 'Market', to: '/products', icon: 'market' },
  { label: 'Listings', to: '/orders', icon: 'list' },
  { label: 'Profile', to: '/profile', icon: 'profile' }
];

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.slice(0, 2).map(tab => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <TabIcon name={tab.icon} />
          <span>{tab.label}</span>
        </NavLink>
      ))}

      <Link to="/upload" className="bottom-nav-fab" aria-label="Upload a listing" title="Upload a listing">
        <TabIcon name="plus" />
      </Link>

      {TABS.slice(2).map(tab => (
        <NavLink key={tab.to} to={tab.to} end={tab.end} className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}>
          <TabIcon name={tab.icon} />
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

