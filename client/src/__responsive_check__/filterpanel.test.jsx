import React from 'react';
import { render, act } from '@testing-library/react';
import FilterPanel from '../components/marketplace/FilterPanel';

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
  it('should only render a handful of platform buttons by default, with the rest behind +N', () => {
    render(<FilterPanel {...baseProps()} />);
    const allToggles = document.querySelectorAll('.platform-toggle');
    const moreBtn = document.querySelector('.platform-more');
    expect(moreBtn).not.toBeNull();
    expect(moreBtn.textContent).toBe('+3');
    // This is the key expectation from the mockup: NOT all 6 platforms should be
    // present in the default (unexpanded) DOM — only the first few + the +N pill.
    expect(allToggles.length).toBeLessThanOrEqual(3);
  });

  it('clicking +N reveals all platforms', () => {
    render(<FilterPanel {...baseProps()} />);
    const moreBtn = document.querySelector('.platform-more');
    act(() => { moreBtn.click(); });
    const allToggles = document.querySelectorAll('.platform-toggle');
    expect(allToggles.length).toBe(6);
  });
});
