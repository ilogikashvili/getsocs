import React, { useEffect, useMemo, useState } from 'react';
import { getProducts } from '../services/productService';
import { ListingCard, extractProductList } from './marketplaceShared';
import FilterPanel from '../components/marketplace/FilterPanel';

const PAGE_SIZE = 16;

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [activePlatforms, setActivePlatforms] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [monetizedOnly, setMonetizedOnly] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [followerRange, setFollowerRange] = useState({ min: '', max: '' });
  const [incomeRange, setIncomeRange] = useState({ min: '', max: '' });
  const [sortBy, setSortBy] = useState('Newest first');

  useEffect(() => {
    let mounted = true;

    async function loadProducts() {
      setLoading(true);
      setError('');
      try {
        const response = await getProducts();
        if (mounted) setProducts(extractProductList(response));
      } catch (err) {
        console.error('Unable to load listings', err);
        if (mounted) setError('Unable to load listings right now.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProducts();
    return () => { mounted = false; };
  }, []);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter(item => {
      const price = Number(item.price) || 0;
      const followers = Number(item.followers) || 0;
      const income = Number(item.income || item.monthlyIncome) || 0;
      if (activePlatforms.length > 0 && !activePlatforms.includes(item.platform)) return false;
      if (searchName && !String(item.title || '').toLowerCase().includes(searchName.toLowerCase())) return false;
      if (activeCategory !== 'All' && item.topic !== activeCategory) return false;
      if (monetizedOnly && !item.monetized) return false;
      if (verifiedOnly && item.verified === false) return false;
      if (priceRange.min !== '' && price < Number(priceRange.min)) return false;
      if (priceRange.max !== '' && price > Number(priceRange.max)) return false;
      if (followerRange.min !== '' && followers < Number(followerRange.min)) return false;
      if (followerRange.max !== '' && followers > Number(followerRange.max)) return false;
      if (incomeRange.min !== '' && income < Number(incomeRange.min)) return false;
      if (incomeRange.max !== '' && income > Number(incomeRange.max)) return false;
      return true;
    });

    const sorted = [...filtered];
    if (sortBy === 'Price: Low to High') sorted.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
    else if (sortBy === 'Price: High to Low') sorted.sort((a, b) => (Number(b.price) || 0) - (Number(a.price) || 0));
    else if (sortBy === 'Most followers') sorted.sort((a, b) => (Number(b.followers) || 0) - (Number(a.followers) || 0));
    else sorted.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return sorted;
  }, [products, activePlatforms, searchName, activeCategory, monetizedOnly, verifiedOnly, priceRange.min, priceRange.max, followerRange.min, followerRange.max, incomeRange.min, incomeRange.max, sortBy]);

  useEffect(() => {
    // Reset pagination whenever the filters/sort change so users aren't
    // stranded deep in a list that no longer matches their criteria.
    setVisibleCount(PAGE_SIZE);
  }, [activePlatforms, searchName, activeCategory, monetizedOnly, verifiedOnly, priceRange, followerRange, incomeRange, sortBy]);

  const visibleProducts = useMemo(() => filteredProducts.slice(0, visibleCount), [filteredProducts, visibleCount]);
  const hasMore = visibleCount < filteredProducts.length;

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
        className="marketplace-filter-bar"
      />

      <section className="target-listings-panel">
        <header>
          <h2>Marketplace</h2>
          <span>{filteredProducts.length} listing{filteredProducts.length === 1 ? '' : 's'}</span>
        </header>

        {loading ? (
          <div className="market-empty-panel">
            <h2>Loading listings</h2>
            <p>Checking the marketplace for active social accounts.</p>
          </div>
        ) : error ? (
          <div className="market-empty-panel">
            <h2>Something went wrong</h2>
            <p>{error}</p>
          </div>
        ) : visibleProducts.length ? (
          <>
            <div className="target-listing-grid">
              {visibleProducts.map(item => <ListingCard key={item.id} item={item} />)}
            </div>
            {hasMore && (
              <div className="marketplace-load-more">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setVisibleCount(count => count + PAGE_SIZE)}
                >
                  Load more listings
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="market-empty-panel">
            <h2>No listings match your filters</h2>
            <p>Try widening your price or audience range.</p>
          </div>
        )}
      </section>
    </div>
  );
}
