import React from 'react';
import { render, act } from '@testing-library/react';
import FilterPanel from '../components/marketplace/FilterPanel';
import { VISIBLE_PLATFORMS } from '../pages/marketplaceShared';

function noop() {}

function baseProps(overrides = {}) {
  return {
    activePlatforms: [],
    setActivePlatforms: noop,
    searchName: '',
    setSearchName: noop,
    activeCategory: 'All',
    setActiveCategory: noop,
    monetizedOnly: false,
    setMonetizedOnly: noop,
    verifiedOnly: false,
    setVerifiedOnly: noop,
    followerRange: { min: '', max: '' },
    setFollowerRange: noop,
    priceRange: { min: '', max: '' },
    setPriceRange: noop,
    incomeRange: { min: '', max: '' },
    setIncomeRange: noop,
    sortBy: 'Newest first',
    setSortBy: noop,
    onClear: noop,
    onSearch: noop,
    ...overrides
  };
}

describe('FilterPanel platform pill truncation (mockup: only 2-3 chips + "+N" visible by default)', () => {
  it('renders the compact platform row without overflowing its available choices', () => {
    render(<FilterPanel {...baseProps()} />);
    const allToggles = document.querySelectorAll('.platform-toggle');
    const moreBtn = document.querySelector('.platform-more');

    expect(allToggles.length).toBeLessThanOrEqual(3);
    if (VISIBLE_PLATFORMS.length > 3) {
      expect(moreBtn).not.toBeNull();
      expect(moreBtn.textContent).toBe(`+${VISIBLE_PLATFORMS.length - 3}`);
    } else {
      expect(moreBtn).toBeNull();
      expect(allToggles.length).toBe(VISIBLE_PLATFORMS.length);
    }
  });

  it('clicking +N reveals all platforms when additional platforms exist', () => {
    render(<FilterPanel {...baseProps()} />);
    const moreBtn = document.querySelector('.platform-more');
    if (moreBtn) act(() => { moreBtn.click(); });
    const allToggles = document.querySelectorAll('.platform-toggle');
    expect(allToggles.length).toBe(VISIBLE_PLATFORMS.length);
  });
});
