import React, { useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AuthContext from '../../context/AuthContext';
import NotificationIcon from '../notifications/NotificationIcon';
import axios, { getUploadUrl } from '../../api/axios';
import ThemeToggle from './ThemeToggle';

function HeaderIcon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': 'true'
  };

  if (name === 'search') {
    return (
      <svg {...common}>
        <path d="M21 21l-4.2-4.2m1.2-5.3a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 6-3 9h18c0-3-3-2-3-9Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 20a2.3 2.3 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'cart') {
    return (
      <svg {...common}>
        <path d="M4 5h2l2 11h9.5l2-7.5H7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 20h.1M17 20h.1" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'menu') {
    return (
      <svg {...common}>
        <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  if (name === 'upload') {
    return (
      <svg {...common}>
        <path d="M12 15V4M12 4 8 8m4-4 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return null;
}

// Cart UI removed from header (cart handled on /cart page)

function NotificationPreviewRow({ item }) {
  const unseenStyle = item.unread ? { boxShadow: '0 0 0 3px rgba(255,200,0,0.12)', borderRadius: 6 } : undefined;
  return (
    <article className={`notification-dropdown-row ${item.unread ? 'is-unseen' : ''}`} style={unseenStyle}>
      <span className={`notification-icon-bubble ${item.tone}`}>
        <NotificationIcon name={item.icon} />
      </span>
      <span>
        <strong>{item.title}</strong>
        <small>{item.text}</small>
      </span>
      <time>{item.time}</time>
      <em className={item.priority ? 'is-priority' : ''} aria-hidden="true" />
    </article>
  );
}

function NotificationDropdown({ items, onClose, onMarkAllRead }) {
  const [activeFilter, setActiveFilter] = useState('all');
  const visibleFilters = [{ id: 'all', label: 'All' }, { id: 'orders', label: 'Orders' }, { id: 'market', label: 'Market' }, { id: 'system', label: 'System' }];
  const visibleItems = activeFilter === 'all' || activeFilter === 'unread'
    ? items
    : items.filter(item => item.category === activeFilter);
  const unreadCount = items.filter(item => item.unread).length;

  return (
    <section className="notification-dropdown" aria-label="Notifications preview">
      <header>
        <div>
          <h2>Notifications</h2>
          <span>{unreadCount}</span>
        </div>
        <button type="button" onClick={onMarkAllRead}>
          <NotificationIcon name="check" size={15} />
          Mark all as read
        </button>
      </header>

      <div className="notification-dropdown-tabs" role="tablist" aria-label="Notification filters">
        {visibleFilters.map(filter => (
          <button
            key={filter.id}
            type="button"
            className={activeFilter === filter.id ? 'active' : ''}
            onClick={() => setActiveFilter(filter.id)}
          >
            {filter.label}
            {filter.badge && <span>{filter.badge}</span>}
          </button>
        ))}
      </div>

      <div className="notification-dropdown-list">
        {visibleItems.map(item => <NotificationPreviewRow key={item.id} item={item} />)}
      </div>

      <Link className="notification-dropdown-all" to="/notifications" onClick={onClose}>
        View all notifications <span aria-hidden="true">-&gt;</span>
      </Link>
    </section>
  );
}

export default function Header({ onToggleNav, navOpen }) {
  const { user, logout } = useContext(AuthContext);
  const location = useLocation();
  const [openMenu, setOpenMenu] = useState('');
  const [notifications, setNotifications] = useState([]);
  const notificationRef = useRef(null);
  const notificationCount = notifications.filter(item => item.unread).length;
  const notificationOpen = openMenu === 'notifications';
  const profilePhotoUrl = user?.profilePhoto ? getUploadUrl(user.profilePhoto) : '/getsocs-logo.png';
  const isNotificationsPage = location.pathname === '/notifications';

  useEffect(() => {
    setOpenMenu('');
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;

    async function loadHeaderData() {
      try {
        const notificationsRes = await axios.get('/notifications');
        if (!mounted) return;
        const apiNotifications = Array.isArray(notificationsRes?.data?.data) ? notificationsRes.data.data : [];
        setNotifications(apiNotifications.length ? apiNotifications : []);
      } catch (error) {
        if (mounted) setNotifications([]);
      }
    }

    if (user) loadHeaderData();
    else setNotifications([]);

    return () => { mounted = false; };
  }, [user]);

  useEffect(() => {
    return undefined;
  }, []);

  useEffect(() => {
    if (!openMenu) return undefined;

    function handleOutsideClick(event) {
      const insideNotifications = notificationRef.current?.contains(event.target);
      if (insideNotifications) return;
      setOpenMenu('');
    }

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [openMenu]);

  return (
    <header className="app-header">
      <button
        type="button"
        className="header-hamburger"
        onClick={onToggleNav}
        aria-label={navOpen ? 'Close menu' : 'Open menu'}
        aria-expanded={navOpen}
      >
        <HeaderIcon name="menu" />
      </button>
      <Link className="header-compact-logo" to="/" aria-label="Getsocs home">
        <img src="/getsocs-logo.png" alt="GS" />
      </Link>
      <span className="header-balance-spacer" aria-hidden="true" />

      <label className="header-search" aria-label="Search marketplace">
        <HeaderIcon name="search" />
        <input type="search" placeholder="Search account, creator, category or platform..." />
      </label>

      <div className="header-right">
        <ThemeToggle />
        <div className={`header-notifications ${notificationOpen ? 'is-open' : ''} ${isNotificationsPage ? 'is-active' : ''}`} ref={notificationRef}>
          <button
            className="header-mini-btn header-notification-trigger"
            type="button"
            title="Notifications"
            aria-label="Notifications"
            aria-expanded={notificationOpen}
            onClick={() => setOpenMenu(menu => menu === 'notifications' ? '' : 'notifications')}
          >
            <HeaderIcon name="bell" />
            <span className="header-notification-badge">{notificationCount}</span>
          </button>
          {notificationOpen && (
            <NotificationDropdown
              items={notifications}
              onClose={() => setOpenMenu('')}
              onMarkAllRead={async () => {
                try {
                  await axios.post('/notifications/mark-all-read');
                  setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
                } catch (e) {}
              }}
            />
          )}
        </div>
        {/* Cart removed from header */}
        <Link className="header-upload-btn" to="/upload" title="Upload a listing" aria-label="Upload a listing">
          <HeaderIcon name="upload" />
          Upload
        </Link>
        {user ? (
          <>
            <Link className="header-profile" to="/profile" aria-label="Go to profile">
              <img src={profilePhotoUrl} alt="Profile" />
            </Link>
            <button className="header-logout" type="button" onClick={logout}>Logout</button>
          </>
        ) : (
          <>
            <Link className="header-profile header-profile-placeholder" to="/login" aria-label="Login">
              <span>👤</span>
            </Link>
            <Link className="header-logout" to="/login">Login</Link>
          </>
        )}
      </div>
    </header>
  );
}
