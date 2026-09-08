import React from 'react';
import { render, screen, cleanup, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../components/layout/Layout';
import { AuthProvider } from '../context/AuthContext';

function setViewport(width, height = 900) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: height });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

function renderShell(initialWidth) {
  setViewport(initialWidth);
  return render(
    <MemoryRouter initialEntries={['/']}>
      <AuthProvider>
        <Layout><div data-testid="page-content">page</div></Layout>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Responsive shell — real component behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    cleanup();
  });

  it('DESKTOP (1440px): no hamburger visible-by-default state, no bottom nav, sidebar not forced collapsed', async () => {
    renderShell(1440);
    const shell = document.querySelector('.app-shell');
    expect(shell.classList.contains('is-rail')).toBe(false); // starts expanded on desktop
    expect(document.querySelector('.bottom-nav')).toBeNull(); // no mobile tab bar
    expect(document.querySelector('.sidebar.is-drawer')).toBeNull(); // not a drawer
    expect(document.querySelector('.header-hamburger')).not.toBeNull(); // hamburger exists in DOM (CSS hides it >1024px)
  });

  it('sidebar-promo ("Secure Escrow" box) has been fully removed from the sidebar', async () => {
    renderShell(1440);
    expect(document.querySelector('.sidebar-promo')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Secure Escrow/i);
  });

  it('TABLET (900px, within 768-1024): sidebar defaults to icon rail, no bottom nav, no drawer', async () => {
    renderShell(900);
    const shell = document.querySelector('.app-shell');
    expect(shell.classList.contains('is-rail')).toBe(true); // tablet auto-collapses to rail
    expect(document.querySelector('.bottom-nav')).toBeNull();
    expect(document.querySelector('.sidebar.is-drawer')).toBeNull();
  });

  it('TABLET: clicking hamburger expands the rail back to full sidebar (push layout, not overlay)', async () => {
    renderShell(900);
    expect(document.querySelector('.app-shell').classList.contains('is-rail')).toBe(true);
    const hamburger = document.querySelector('.header-hamburger');
    await act(async () => { hamburger.click(); });
    expect(document.querySelector('.app-shell').classList.contains('is-rail')).toBe(false);
    expect(document.querySelector('.sidebar-backdrop')).toBeNull(); // confirms push, not overlay/backdrop
  });

  it('MOBILE (375px): sidebar becomes a drawer (closed by default), bottom nav renders', async () => {
    renderShell(375);
    expect(document.querySelector('.sidebar').classList.contains('is-drawer')).toBe(true);
    expect(document.querySelector('.sidebar').classList.contains('is-open')).toBe(false); // closed by default
    expect(document.querySelector('.bottom-nav')).not.toBeNull();
    expect(document.querySelectorAll('.bottom-nav-item').length).toBe(4); // Home, Market, Listings, Profile
    expect(document.querySelector('.bottom-nav-fab')).not.toBeNull(); // center FAB
  });

  it('MOBILE: clicking hamburger opens the drawer + backdrop, closing via X works', async () => {
    renderShell(375);
    const hamburger = document.querySelector('.header-hamburger');
    await act(async () => { hamburger.click(); });
    expect(document.querySelector('.sidebar').classList.contains('is-open')).toBe(true);
    expect(document.querySelector('.sidebar-backdrop')).not.toBeNull();
    const closeBtn = document.querySelector('.sidebar-close');
    expect(closeBtn).not.toBeNull();
    await act(async () => { closeBtn.click(); });
    expect(document.querySelector('.sidebar').classList.contains('is-open')).toBe(false);
  });

  it('MOBILE: clicking the backdrop closes the drawer', async () => {
    renderShell(375);
    await act(async () => { document.querySelector('.header-hamburger').click(); });
    expect(document.querySelector('.sidebar-backdrop')).not.toBeNull();
    await act(async () => { document.querySelector('.sidebar-backdrop').click(); });
    expect(document.querySelector('.sidebar-backdrop')).toBeNull();
  });

  it('BOUNDARY 767 -> 768: crossing from mobile to tablet removes bottom-nav and switches sidebar from drawer to rail', async () => {
    renderShell(767);
    expect(document.querySelector('.bottom-nav')).not.toBeNull();
    expect(document.querySelector('.sidebar').classList.contains('is-drawer')).toBe(true);
    setViewport(768);
    expect(document.querySelector('.bottom-nav')).toBeNull();
    expect(document.querySelector('.sidebar').classList.contains('is-drawer')).toBe(false);
    expect(document.querySelector('.app-shell').classList.contains('is-rail')).toBe(true);
  });

  it('BOUNDARY mobile -> desktop direct jump: still lands in the right rail state (regression check)', async () => {
    localStorage.setItem('gs_sidebar_collapsed', '1');
    renderShell(375);
    expect(document.querySelector('.sidebar').classList.contains('is-drawer')).toBe(true);
    setViewport(1440);
    expect(document.querySelector('.app-shell').classList.contains('is-rail')).toBe(true); // respects saved '1'
    expect(document.querySelector('.sidebar').classList.contains('is-drawer')).toBe(false);
  });

  it('BOUNDARY 1024 -> 1025: crossing from tablet to desktop restores sidebar from user\'s saved preference', async () => {
    localStorage.setItem('gs_sidebar_collapsed', '0');
    renderShell(1024);
    expect(document.querySelector('.app-shell').classList.contains('is-rail')).toBe(true); // tablet forces rail
    setViewport(1025);
    expect(document.querySelector('.app-shell').classList.contains('is-rail')).toBe(false); // desktop restores saved '0' (expanded)
  });

  it('DESKTOP: collapse toggle persists to localStorage and survives remount', async () => {
    const { unmount } = renderShell(1440);
    const toggle = document.querySelector('.sidebar-toggle');
    await act(async () => { toggle.click(); });
    expect(document.querySelector('.app-shell').classList.contains('is-rail')).toBe(true);
    expect(localStorage.getItem('gs_sidebar_collapsed')).toBe('1');
    unmount();
    renderShell(1440);
    expect(document.querySelector('.app-shell').classList.contains('is-rail')).toBe(true); // remembered
  });

  it('Navigating on mobile auto-closes the drawer', async () => {
    renderShell(375);
    await act(async () => { document.querySelector('.header-hamburger').click(); });
    expect(document.querySelector('.sidebar').classList.contains('is-open')).toBe(true);
    const marketplaceLink = screen.getByText('Marketplace').closest('a');
    await act(async () => { marketplaceLink.click(); });
    expect(document.querySelector('.sidebar').classList.contains('is-open')).toBe(false);
  });
});
