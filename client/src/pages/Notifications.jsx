import React, { useEffect, useMemo, useState } from 'react';
import axios from '../api/axios';
import NotificationIcon from '../components/notifications/NotificationIcon';

function NotificationFilterTabs({ activeFilter, onChange }) {
  const filters = [{ id: 'all', label: 'All' }, { id: 'orders', label: 'Orders' }, { id: 'market', label: 'Market' }, { id: 'system', label: 'System' }];

  return (
    <div className="notifications-filter-tabs" role="tablist" aria-label="Notification filters">
      {filters.map(filter => (
        <button
          key={filter.id}
          type="button"
          className={activeFilter === filter.id ? 'active' : ''}
          onClick={() => onChange(filter.id)}
        >
          {filter.label}
          {filter.badge && <span>{filter.badge}</span>}
        </button>
      ))}
    </div>
  );
}

function NotificationRow({ item }) {
  return (
    <article className="notification-page-row">
      <i className={item.priority ? 'is-priority' : ''} aria-hidden="true" />
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

function NotificationSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      className={`notification-switch ${checked ? 'on' : ''}`}
      aria-pressed={checked}
      onClick={onChange}
    >
      <span />
    </button>
  );
}

function PreferenceRow({ item, checked, onToggle }) {
  return (
    <div className="notification-preference-row">
      <span><NotificationIcon name={item.icon} /></span>
      <div>
        <strong>{item.title}</strong>
        <small>{item.text}</small>
      </div>
      <NotificationSwitch checked={checked} onChange={onToggle} />
    </div>
  );
}

export default function Notifications() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState({
    orders: true,
    messages: true,
    security: true
  });
  const [quietHours, setQuietHours] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function loadNotifications() {
      setLoading(true);
      try {
        const res = await axios.get('/notifications');
        if (!mounted) return;
        setNotifications(Array.isArray(res.data?.data) ? res.data.data : []);
      } catch (error) {
        if (mounted) setNotifications([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadNotifications();
    return () => { mounted = false; };
  }, []);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') return notifications;
    if (activeFilter === 'unread') return notifications.filter(item => item.unread);
    return notifications.filter(item => item.category === activeFilter);
  }, [activeFilter, notifications]);

  const unreadCount = notifications.filter(item => item.unread).length;

  function togglePreference(id) {
    setPreferences(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <div className="notifications-page">
      <section className="notifications-page-header">
        <h1>Notifications</h1>
        <p>Manage how you stay updated on activity that matters to you.</p>
      </section>

      <section className="notifications-toolbar">
        <NotificationFilterTabs activeFilter={activeFilter} onChange={setActiveFilter} />
        <div className="notifications-toolbar-actions">
          <button type="button">
            <NotificationIcon name="check" size={15} />
            Mark all as read
          </button>
          <label>
            <select defaultValue="Most recent" aria-label="Sort notifications">
              <option>Most recent</option>
              <option>Oldest first</option>
              <option>Unread first</option>
            </select>
          </label>
        </div>
      </section>

      <div className="notifications-layout">
        <section className="notifications-list-card" aria-label="Notification list">
          {loading ? <div className="empty-state">Loading notifications...</div> : filteredNotifications.map(item => <NotificationRow key={item.id} item={item} />)}
          {!loading && !filteredNotifications.length && (
            <div className="notifications-empty-state">
              <NotificationIcon name="bell" size={24} />
              <strong>No notifications here</strong>
              <p>Try another filter or check back later.</p>
            </div>
          )}
        </section>

        <aside className="notifications-side-panel">
          <section className="notification-side-card">
            <h2>Notification Preferences</h2>
            <div className="notification-preference-list">
              {[
                { id: 'orders', icon: 'basket', title: 'Orders', text: 'Updates on purchases and escrow progress.' },
                { id: 'messages', icon: 'message', title: 'Messages', text: 'New replies from sellers and support.' },
                { id: 'security', icon: 'shield', title: 'Security', text: 'Account activity and transaction alerts.' }
              ].map(item => (
                <PreferenceRow
                  key={item.id}
                  item={item}
                  checked={preferences[item.id]}
                  onToggle={() => togglePreference(item.id)}
                />
              ))}
            </div>
          </section>

          <section className="notification-side-card quiet-hours-card">
            <header>
              <div>
                <h2>Quiet Hours</h2>
                <p>Pause non-essential notifications during these hours.</p>
              </div>
              <NotificationSwitch checked={quietHours} onChange={() => setQuietHours(value => !value)} />
            </header>
            <div className="quiet-hours-controls">
              <select defaultValue="22:00" aria-label="Quiet hours start">
                <option>22:00</option>
                <option>21:00</option>
                <option>23:00</option>
              </select>
              <span>to</span>
              <select defaultValue="08:00" aria-label="Quiet hours end">
                <option>08:00</option>
                <option>07:00</option>
                <option>09:00</option>
              </select>
            </div>
            <small>Time zone: (GMT+4) Tbilisi</small>
          </section>

          <section className="notification-side-card">
            <h2>Notification Tips</h2>
            <div className="notification-tip-list">
              {[
                { id: 1, tone: 'green', icon: 'shield', title: 'Stay protected', text: 'Review escrow updates before confirming a transfer.' },
                { id: 2, tone: 'violet', icon: 'bell', title: 'Reply quickly', text: 'Fast responses help create stronger buyer trust.' }
              ].map(item => (
                <div key={item.id} className="notification-tip-row">
                  <span className={item.tone}><NotificationIcon name={item.icon} /></span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <span className="notifications-hidden-count" aria-hidden="true">{unreadCount}</span>
    </div>
  );
}
