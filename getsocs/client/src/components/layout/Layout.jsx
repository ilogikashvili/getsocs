import React, { useContext, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import BottomNav from './BottomNav';
import SupportChat from './SupportChat';
import AuthContext from '../../context/AuthContext';
import InstallAppPrompt from './InstallAppPrompt';

const TABLET_MAX = 1024;
const MOBILE_MAX = 767;

function getViewport(width) {
  if (width <= MOBILE_MAX) return 'mobile';
  if (width <= TABLET_MAX) return 'tablet';
  return 'desktop';
}

export default function Layout({ children }) {
  const { user } = useContext(AuthContext);
  const location = useLocation();
  const isAdminShell = user?.role === 'admin' || user?.role === 'escrow';
  const hideShell = isAdminShell || location.pathname.startsWith('/messages') || location.pathname.startsWith('/support') ||
    ['/login', '/register', '/reset-password'].includes(location.pathname);

  const [viewport, setViewport] = useState(() => (
    typeof window === 'undefined' ? 'desktop' : getViewport(window.innerWidth)
  ));
  const [railCollapsed, setRailCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    const width = window.innerWidth;
    if (width <= TABLET_MAX && width > MOBILE_MAX) return true; // tablet defaults to icon rail
    try { return localStorage.getItem('gs_sidebar_collapsed') === '1'; } catch (e) { return false; }
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    function handleResize() {
      const next = getViewport(window.innerWidth);
      setViewport(prev => {
        if (prev === next) return prev;
        if (next === 'tablet' && prev !== 'tablet') setRailCollapsed(true);
        if (next === 'desktop' && prev !== 'desktop') {
          try { setRailCollapsed(localStorage.getItem('gs_sidebar_collapsed') === '1'); } catch (e) { setRailCollapsed(false); }
        }
        if (next === 'mobile') setMobileNavOpen(false);
        return next;
      });
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileNavOpen]);

  function toggleNav() {
    if (viewport === 'mobile') {
      setMobileNavOpen(open => !open);
    } else {
      setRailCollapsed(collapsed => {
        const next = !collapsed;
        if (viewport === 'desktop') {
          try { localStorage.setItem('gs_sidebar_collapsed', next ? '1' : '0'); } catch (e) {}
        }
        return next;
      });
    }
  }

  const shellClasses = [
    'app-shell',
    hideShell ? 'no-shell' : '',
    isAdminShell ? 'admin-layout-host' : '',
    (railCollapsed && viewport !== 'mobile') ? 'is-rail' : '',
    mobileNavOpen ? 'is-nav-open' : ''
  ].filter(Boolean).join(' ');
  const mainAreaClass = hideShell
    ? `main-area no-shell ${isAdminShell ? 'admin-layout-area' : ''}`.trim()
    : 'main-area';
  const mainContentClass = isAdminShell
    ? 'main-content admin-layout-content'
    : 'main-content';

  return (
    <div className={shellClasses}>
      {!hideShell && (
        <Sidebar
          collapsed={railCollapsed && viewport !== 'mobile'}
          mobileOpen={mobileNavOpen}
          viewport={viewport}
          onToggleCollapse={toggleNav}
          onClose={() => setMobileNavOpen(false)}
        />
      )}
      {!hideShell && mobileNavOpen && (
        <div className="sidebar-backdrop" onClick={() => setMobileNavOpen(false)} aria-hidden="true" />
      )}
      <div className={mainAreaClass}>
        {!hideShell && <Header onToggleNav={toggleNav} navOpen={mobileNavOpen} />}
        <main className={mainContentClass}>{children}</main>
      </div>
      {!hideShell && viewport === 'mobile' && <BottomNav />}
      {!isAdminShell && <InstallAppPrompt />}
      {!isAdminShell && <SupportChat />}
    </div>
  );
}
