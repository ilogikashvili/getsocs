import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { getProducts } from '../services/productService';
import FilterPanel from '../components/marketplace/FilterPanel';
import DashboardReviews from '../components/reviews/DashboardReviews';
import {
  PLATFORMS,
  ShieldCheckIcon,
  BadgeCheckIcon,
  PlatformGlyph,
  extractProductList,
  ListingCard
} from './marketplaceShared';

export {
  PLATFORMS,
  VISIBLE_PLATFORMS,
  CATEGORIES,
  SORT_OPTIONS,
  formatPrice,
  formatFollowers,
  extractProductList,
  ShieldCheckIcon,
  BadgeCheckIcon,
  PlatformGlyph,
  getListingImage,
  ListingCard
} from './marketplaceShared';

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function HeroShield() {
  return (
    <div className="hero-visual" aria-hidden="true">
      <div className="star star-one" />
      <div className="star star-two" />
      <div className="hero-orbit orbit-one" />
      <div className="hero-orbit orbit-two" />
      <span className="hero-platform-badge badge-telegram"><PlatformGlyph platform="Telegram" /></span>
      <span className="hero-platform-badge badge-youtube"><PlatformGlyph platform="YouTube" /></span>
      <span className="hero-platform-badge badge-tiktok"><PlatformGlyph platform="TikTok" /></span>
      <div className="shield-stage">
        <div className="shield-base" />
        <svg className="trust-shield" viewBox="0 0 180 180" fill="none">
          <path d="M91 14 152 39v43c0 43-25 70-62 88-37-18-62-45-62-88V39l63-25Z" fill="url(#shieldFill)" stroke="url(#shieldStroke)" strokeWidth="13" strokeLinejoin="round" />
          <path d="m63 86 22 21 40-43" stroke="#42f1ff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
          <defs>
            <linearGradient id="shieldFill" x1="39" y1="31" x2="148" y2="142" gradientUnits="userSpaceOnUse">
              <stop stopColor="#213c7b" />
              <stop offset="1" stopColor="#111b4d" />
            </linearGradient>
            <linearGradient id="shieldStroke" x1="20" y1="18" x2="160" y2="156" gradientUnits="userSpaceOnUse">
              <stop stopColor="#7c5cff" />
              <stop offset="0.55" stopColor="#4f7dff" />
              <stop offset="1" stopColor="#8d35ff" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

function EmptyIllustration() {
  return (
    <div className="empty-illustration" aria-hidden="true">
      <div className="empty-phone" />
      <div className="empty-lens" />
      <span className="empty-dot dot-a" />
      <span className="empty-dot dot-b" />
      <span className="empty-dot dot-c" />
    </div>
  );
}

export default function Home() {
  const location = useLocation();
  const urlPlatform = useMemo(() => {
    const requested = new URLSearchParams(location.search).get('platform') || 'all';
    const match = PLATFORMS.find(platform => platform.toLowerCase() === requested.toLowerCase());
    return match || 'All';
  }, [location.search]);

  const [activePlatforms, setActivePlatforms] = useState(urlPlatform === 'All' ? [] : [urlPlatform]);
  const [searchName, setSearchName] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [monetizedOnly, setMonetizedOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [followerRange, setFollowerRange] = useState({ min: '', max: '' });
  const [incomeRange, setIncomeRange] = useState({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('Newest first');
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');

  useEffect(() => {
    setActivePlatforms(urlPlatform === 'All' ? [] : [urlPlatform]);
  }, [urlPlatform]);

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      setLoadingProducts(true);
      setProductsError('');
      try {
        const response = await getProducts();
        if (mounted) setProducts(extractProductList(response));
      } catch (error) {
        console.error('Unable to load listings', error);
        if (mounted) setProductsError('Unable to load listings right now.');
      } finally {
        if (mounted) setLoadingProducts(false);
      }
    }

    loadProducts();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter(item => {
      const price = Number(item.price) || 0;
      const followers = Number(item.followers) || 0;
      const income = Number(item.income || item.monthlyIncome) || 0;
      if (activePlatforms.length > 0 && !activePlatforms.includes(item.platform)) return false;
      if (searchName && !String(item.title || '').toLowerCase().includes(searchName.toLowerCase())) return false;
      if (priceRange.min !== '' && price < Number(priceRange.min)) return false;
      if (priceRange.max !== '' && price > Number(priceRange.max)) return false;
      if (followerRange.min !== '' && followers < Number(followerRange.min)) return false;
      if (followerRange.max !== '' && followers > Number(followerRange.max)) return false;
      if (incomeRange.min !== '' && income < Number(incomeRange.min)) return false;
      if (incomeRange.max !== '' && income > Number(incomeRange.max)) return false;
      if (activeCategory !== 'All' && item.topic !== activeCategory) return false;
      if (monetizedOnly && (item.platform !== 'YouTube' || !item.monetized)) return false;
      if (verifiedOnly && item.verified === false) return false;
      return true;
    });

    const sorted = [...filtered];
    if (sortBy === 'Price: Low to High') sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    else if (sortBy === 'Price: High to Low') sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    else if (sortBy === 'Most followers') sorted.sort((a, b) => (Number(b.followers) || 0) - (Number(a.followers) || 0));
    else sorted.reverse();
    return sorted;
  }, [activePlatforms, searchName, priceRange.max, priceRange.min, followerRange.max, followerRange.min, incomeRange.max, incomeRange.min, activeCategory, monetizedOnly, verifiedOnly, sortBy, products]);

  const visibleProducts = useMemo(() => filteredProducts.slice(0, 8), [filteredProducts]);
  const featuredListings = visibleProducts;

  function clearFilters() {
    setActivePlatforms([]);
    setSearchName('');
    setActiveCategory('All');
    setMonetizedOnly(false);
    setVerifiedOnly(false);
    setPriceRange({ min: '', max: '' });
    setFollowerRange({ min: '', max: '' });
    setIncomeRange({ min: '', max: '' });
    setSortBy('Newest first');
  }

  return (
    <div className="market-dashboard">
      <section className="market-hero">
        <div className="hero-copy">
          <h1>The Most Trusted<br />Social Account Marketplace</h1>
          <p>Buy, sell and discover premium social accounts with escrow protection and verified listings.</p>
          <div className="hero-actions">
            <Link className="market-btn primary" to="/upload">Sell Your Page</Link>
            <Link className="market-btn secondary" to="/products">Browse Top Listings</Link>
          </div>
          <ul className="hero-trust-strip">
            <li><ShieldCheckIcon /> Escrow protected</li>
            <li><BadgeCheckIcon /> Verified listings</li>
            <li><ClockIcon /> 24/7 support</li>
          </ul>
        </div>
        <HeroShield />
      </section>

      <FilterPanel
        activePlatforms={activePlatforms}
        setActivePlatforms={setActivePlatforms}
        searchName={searchName}
        setSearchName={setSearchName}
        activeCategory={activeCategory}
        setActiveCategory={setActiveCategory}
        monetizedOnly={monetizedOnly}
        setMonetizedOnly={setMonetizedOnly}
        verifiedOnly={verifiedOnly}
        setVerifiedOnly={setVerifiedOnly}
        followerRange={followerRange}
        setFollowerRange={setFollowerRange}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
        incomeRange={incomeRange}
        setIncomeRange={setIncomeRange}
        sortBy={sortBy}
        setSortBy={setSortBy}
        onClear={clearFilters}
      />

      <div className="target-dashboard-grid">
        <section className="target-market-area">
          {loadingProducts ? (
            <section className="market-empty-panel">
              <EmptyIllustration />
              <h2>Loading listings</h2>
              <p>Checking the marketplace for active social accounts.</p>
            </section>
          ) : productsError ? (
            <section className="market-empty-panel">
              <EmptyIllustration />
              <h2>No listings found</h2>
              <p>{productsError}</p>
            </section>
          ) : featuredListings.length ? (
            <section className="target-listings-panel">
              <header>
                <div>
                  <h2>Featured Listings</h2>
                  <p className="target-listings-subtitle">Handpicked premium accounts just for you</p>
                </div>
                <Link to="/products">View all -&gt;</Link>
              </header>
              <div className="target-listing-grid">
                {featuredListings.map(item => <ListingCard key={item.id} item={item} />)}
              </div>
            </section>
          ) : (
            <section className="market-empty-panel">
              <EmptyIllustration />
              <h2>No listings match right now</h2>
              <p>Try widening your filters, or be the first to list an account in this category.</p>
              <div className="empty-panel-actions">
                <button type="button" className="btn secondary" onClick={clearFilters}>Clear filters</button>
                <Link className="btn primary" to="/upload">Sell your page</Link>
              </div>
            </section>
          )}
        </section>

        <DashboardReviews />
      </div>
    </div>
  );
}
