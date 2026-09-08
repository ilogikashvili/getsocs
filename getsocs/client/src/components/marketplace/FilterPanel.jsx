import React from 'react';
import {
  CATEGORIES,
  VISIBLE_PLATFORMS,
  SORT_OPTIONS,
  PlatformGlyph,
  ShieldCheckIcon,
  BadgeCheckIcon
} from '../../pages/marketplaceShared';

const SearchGlyph = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M21 21l-4.2-4.2m1.2-5.3a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

function PlatformPillRow({ activePlatforms, setActivePlatforms }) {
  const [expanded, setExpanded] = React.useState(false);
  const hiddenCount = Math.max(0, VISIBLE_PLATFORMS.length - 3);
  const visiblePlatforms = expanded ? VISIBLE_PLATFORMS : VISIBLE_PLATFORMS.slice(0, 3);

  return (
    <div className={`target-pill-row platform-pills ${expanded ? 'is-expanded' : ''}`}>
      {visiblePlatforms.map(platform => (
        <button
          type="button"
          key={platform}
          className={`target-pill platform-toggle ${activePlatforms.includes(platform) ? 'active' : ''}`}
          aria-pressed={activePlatforms.includes(platform)}
          onClick={() => setActivePlatforms(prev => (
            prev.includes(platform) ? prev.filter(p => p !== platform) : [...prev, platform]
          ))}
        >
          <PlatformGlyph platform={platform} />
          {platform}
        </button>
      ))}
      {!expanded && hiddenCount > 0 && (
        <button type="button" className="target-pill platform-more" onClick={() => setExpanded(true)}>
          +{hiddenCount}
        </button>
      )}
    </div>
  );
}

export default function FilterPanel({
  activePlatforms,
  setActivePlatforms,
  searchName,
  setSearchName,
  activeCategory,
  setActiveCategory,
  monetizedOnly,
  setMonetizedOnly,
  verifiedOnly,
  setVerifiedOnly,
  followerRange,
  setFollowerRange,
  priceRange,
  setPriceRange,
  incomeRange,
  setIncomeRange,
  sortBy,
  setSortBy,
  onClear,
  onSearch,
  className = ''
}) {
  return (
    <section className={`target-filter-panel target-filter-bar ${className}`.trim()} aria-label="Marketplace filters">
      <header>
        <h2>Filters</h2>
        <button type="button" onClick={onClear}>Clear all</button>
      </header>

      <PlatformPillRow activePlatforms={activePlatforms} setActivePlatforms={setActivePlatforms} />

      <div className="target-filter-row filter-row-search">
        <label className="target-search-field">
          <SearchGlyph />
          <input
            type="search"
            placeholder="Search by name"
            aria-label="Search by name"
            value={searchName}
            onChange={event => setSearchName(event.target.value)}
          />
        </label>

        <select
          className="target-category-select"
          value={activeCategory}
          onChange={event => setActiveCategory(event.target.value)}
          aria-label="Select topic"
        >
          {CATEGORIES.map(category => (
            <option key={category} value={category}>{category === 'All' ? 'Select topic' : category}</option>
          ))}
        </select>

        <button
          type="button"
          className={`target-toggle-chip ${monetizedOnly ? 'active' : ''}`}
          onClick={() => setMonetizedOnly(value => !value)}
          aria-pressed={monetizedOnly}
        >
          <ShieldCheckIcon /> YouTube monetized
        </button>

        <button
          type="button"
          className={`target-toggle-chip ${verifiedOnly ? 'active' : ''}`}
          onClick={() => setVerifiedOnly(value => !value)}
          aria-pressed={verifiedOnly}
        >
          <BadgeCheckIcon /> Verified identity
        </button>
      </div>

      <div className="target-filter-row filter-row-ranges">
        <section className="target-filter-group">
          <h3>Subscribers</h3>
          <div className="target-range-inputs">
            <label className="target-range-field">
              <span>from</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                aria-label="Minimum subscribers"
                value={followerRange.min}
                onChange={event => setFollowerRange(prev => ({ ...prev, min: event.target.value }))}
              />
            </label>
            <label className="target-range-field">
              <span>to</span>
              <input
                type="number"
                min="0"
                placeholder="Any"
                aria-label="Maximum subscribers"
                value={followerRange.max}
                onChange={event => setFollowerRange(prev => ({ ...prev, max: event.target.value }))}
              />
            </label>
          </div>
        </section>

        <section className="target-filter-group">
          <h3>Price</h3>
          <div className="target-range-inputs">
            <label className="target-range-field">
              <span>from</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                aria-label="Minimum price"
                value={priceRange.min}
                onChange={event => setPriceRange(prev => ({ ...prev, min: event.target.value }))}
              />
            </label>
            <label className="target-range-field">
              <span>to</span>
              <input
                type="number"
                min="0"
                placeholder="Any"
                aria-label="Maximum price"
                value={priceRange.max}
                onChange={event => setPriceRange(prev => ({ ...prev, max: event.target.value }))}
              />
            </label>
          </div>
        </section>

        <section className="target-filter-group">
          <h3>Income</h3>
          <div className="target-range-inputs">
            <label className="target-range-field">
              <span>from</span>
              <input
                type="number"
                min="0"
                placeholder="0"
                aria-label="Minimum income"
                value={incomeRange.min}
                onChange={event => setIncomeRange(prev => ({ ...prev, min: event.target.value }))}
              />
            </label>
            <label className="target-range-field">
              <span>to</span>
              <input
                type="number"
                min="0"
                placeholder="Any"
                aria-label="Maximum income"
                value={incomeRange.max}
                onChange={event => setIncomeRange(prev => ({ ...prev, max: event.target.value }))}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="target-filter-row filter-row-sort">
        <label className="target-sort-field">
          <span>Sort by</span>
          <select value={sortBy} onChange={event => setSortBy(event.target.value)} aria-label="Sort by">
            {SORT_OPTIONS.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
        <button type="button" className="target-search-btn" onClick={onSearch}>
          <SearchGlyph />
          Search
        </button>
      </div>
    </section>
  );
}
