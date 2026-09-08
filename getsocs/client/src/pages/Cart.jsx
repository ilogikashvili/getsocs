import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getUploadUrl } from '../api/axios';

function formatCartPrice(value, options = {}) {
  const decimals = options.decimals ? 2 : 0;
  return `₾${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

function CartIcon({ name }) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': 'true'
  };

  const icons = {
    shield: <path d="M12 3 19 6v5c0 4.4-2.8 7.3-7 10-4.2-2.7-7-5.6-7-10V6l7-3Zm-3 9 2 2 4-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    check: <path d="m5 12.5 4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    info: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-10v5m0-8h.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
    lock: <path d="M7 10V8a5 5 0 0 1 10 0v2m-9.5 0h9A1.5 1.5 0 0 1 18 11.5v7A1.5 1.5 0 0 1 16.5 20h-9A1.5 1.5 0 0 1 6 18.5v-7A1.5 1.5 0 0 1 7.5 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />,
    wallet: <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H18v4h-3a3 3 0 0 0 0 6h3v4H6.5A2.5 2.5 0 0 1 4 16.5v-9Zm12 4h.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    heart: <path d="M20 8.8c0 5-8 10.2-8 10.2S4 13.8 4 8.8A4.2 4.2 0 0 1 11.7 6 4.2 4.2 0 0 1 20 8.8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
    chevron: <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
    arrow: <path d="M19 12H5m0 0 5-5m-5 5 5 5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />,
    support: <path d="M6 14v-2a6 6 0 0 1 12 0v2m-12 0a2 2 0 0 0 2 2h1v-4H8a2 2 0 0 0-2 2Zm12 0a2 2 0 0 1-2 2h-1v-4h1a2 2 0 0 1 2 2Zm-4 4h2a2 2 0 0 0 2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />,
    verified: <path d="m12 3 2 2 2.8-.4.7 2.7 2.5 1.4-1.2 2.6 1.2 2.6-2.5 1.4-.7 2.7-2.8-.4-2 2-2-2-2.8.4-.7-2.7L5 14.9l1.2-2.6L5 9.7l2.5-1.4.7-2.7L11 6l1-3Zm-3 9 2 2 4-5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  };

  return <svg {...common}>{icons[name]}</svg>;
}

function CartProductThumb({ item }) {
  return (
    <span className="cart-product-thumb cart-page-thumb">
      <img src={item.image || '/getsocs-logo.png'} alt="" />
    </span>
  );
}

function VerifiedMark() {
  return (
    <span className="cart-verified-mark" aria-label="Verified account">
      <CartIcon name="verified" />
    </span>
  );
}

function CartItemCard({ item, onRemove }) {
  return (
    <article className="cart-item-card">
      <CartProductThumb item={item} />

      <div className="cart-item-main">
        <span className="cart-platform-line">
          {item.platform || 'Marketplace'}
          <VerifiedMark />
        </span>
        <h2>{item.title}</h2>
        <div className="cart-chip-row">
          <span>{item.topic || 'Listing'}</span>
          {item.platform === 'YouTube' && <span>{item.monetized ? 'Monetized' : 'Non-monetized'}</span>}
        </div>
        <div className="cart-trust-row">
          <strong><CartIcon name="shield" /> Escrow Protected</strong>
          <small aria-hidden="true">-</small>
          <span><CartIcon name="check" /> Verified Seller</span>
        </div>
      </div>

      <aside className="cart-item-side">
        <strong>{formatCartPrice(item.price)}</strong>
        <div>
          <button type="button" className="cart-remove-icon" onClick={() => onRemove(item.id)} aria-label="Remove item from cart">
            ✕
          </button>
          <Link className="cart-view-link" to={`/product/${item.id}`}>View</Link>
        </div>
      </aside>
    </article>
  );
}

function SummaryLine({ label, value, hint, strong, free }) {
  return (
    <p className={strong ? 'cart-summary-total' : ''}>
      <span>
        {label}
        {hint && <CartIcon name="info" />}
      </span>
      <strong className={free ? 'is-free' : ''}>{value}</strong>
    </p>
  );
}

function TrustFeature({ icon, title, text, tone }) {
  return (
    <div className="cart-trust-feature">
      <span className={tone}><CartIcon name={icon} /></span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function CartSummary({ totals }) {
  return (
    <aside className="cart-summary-card">
      <header>
        <h2>Cart Summary</h2>
        <span>{totals.count} items</span>
      </header>

      <div className="cart-summary-lines">
        <SummaryLine label="Subtotal" value={formatCartPrice(totals.subtotal)} />
        <SummaryLine label="Escrow Protection" value="FREE" hint free />
        <SummaryLine label="Service Fee" value={formatCartPrice(totals.serviceFee, { decimals: true })} hint />
        <SummaryLine label="Total" value={formatCartPrice(totals.total, { decimals: true })} strong />
        <small className="cart-vat-note">VAT included</small>
      </div>

      <button className="cart-checkout-btn" type="button">
        <CartIcon name="lock" />
        Proceed to Checkout
      </button>
      <button className="cart-balance-btn" type="button">
        <CartIcon name="wallet" />
        Checkout with Balance
      </button>
      <p className="cart-balance-note">Available Balance: <strong>{formatCartPrice(223)}</strong></p>

      <section className="cart-trust-panel" aria-label="Cart protections">
        <TrustFeature icon="shield" title="Escrow Protection" text="Your payment is held securely until you confirm delivery." tone="green" />
        <TrustFeature icon="verified" title="Verified Accounts" text="All accounts are verified and authenticated." tone="amber" />
        <TrustFeature icon="support" title="24/7 Support" text="Our support team is always here to help you." tone="pink" />
      </section>
    </aside>
  );
}

export default function Cart() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load cart from localStorage (persisted by cart interactions)
    let mounted = true;
    function loadCart() {
      try {
        const raw = window.localStorage.getItem('cart');
        const stored = raw ? JSON.parse(raw) : [];
        if (!mounted) return;
        const mapped = Array.isArray(stored) ? stored.map(product => ({ ...product, image: product.images?.[0] ? getUploadUrl(product.images[0]) : product.image || '' })) : [];
        setItems(mapped);
      } catch (error) {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadCart();
    return () => { mounted = false; };
  }, []);

  const totals = {
    count: items.length,
    subtotal: items.reduce((sum, item) => sum + Number(item.price || 0), 0),
    serviceFee: items.reduce((sum, item) => sum + Number(item.price || 0), 0) * 0.05,
    total: items.reduce((sum, item) => sum + Number(item.price || 0), 0) * 1.05
  };

  const handleRemoveItem = (itemId) => {
    setItems(prev => {
      const next = prev.filter(item => item.id !== itemId);
      try { window.localStorage.setItem('cart', JSON.stringify(next)); } catch (e) {}
      // notify other windows/components
      try { window.dispatchEvent(new CustomEvent('cartUpdated')); } catch (e) {}
      return next;
    });
  };

  return (
    <div className="cart-page">
      <section className="cart-page-header">
        <h1>Your Cart <span>{totals.count}</span></h1>
        <p>Review your selected accounts and proceed to secure checkout.</p>
      </section>

      <div className="cart-layout">
        <section className="cart-items-column" aria-label="Cart items">
          {loading ? <div className="empty-state">Loading your cart...</div> : items.map(item => <CartItemCard key={item.id} item={item} onRemove={handleRemoveItem} />)}

          <button className="cart-saved-row" type="button">
            <span><CartIcon name="heart" /> Saved for later (2 items)</span>
            <CartIcon name="chevron" />
          </button>

          <Link className="cart-continue-link" to="/products">
            <CartIcon name="arrow" />
            Continue Shopping
          </Link>
        </section>

        <CartSummary totals={totals} />
      </div>
    </div>
  );
}
