import React, { useState, useEffect } from 'react';
import '../../css/SearchFilter.css';
import { getMeta } from '../../services/metaService';

export default function FilterPanel({ onFilter }) {
  const [search, setSearch] = useState('');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState('newest');
  const [activeTab, setActiveTab] = useState('All');

  // account-specific filters
  const [platform, setPlatform] = useState('Any');
  const [platformOptions, setPlatformOptions] = useState(['Any', 'YouTube', 'Telegram', 'TikTok']);
  const [minFollowers, setMinFollowers] = useState('');
  const [maxFollowers, setMaxFollowers] = useState('');
  const [minViews, setMinViews] = useState('');
  const [maxViews, setMaxViews] = useState('');
  const [topic, setTopic] = useState('Any');
  const [monetized, setMonetized] = useState('any');

  function apply() {
    onFilter && onFilter({
      search: search.trim(),
      minPrice: minPrice === '' ? null : Number(minPrice),
      maxPrice: maxPrice === '' ? null : Number(maxPrice),
      sort,
      category: activeTab === 'All' ? null : activeTab,
      platform: platform === 'Any' ? null : platform,
      minFollowers: minFollowers === '' ? null : Number(minFollowers),
      maxFollowers: maxFollowers === '' ? null : Number(maxFollowers),
      minViews: minViews === '' ? null : Number(minViews),
      maxViews: maxViews === '' ? null : Number(maxViews),
      topic: topic === 'Any' ? null : topic,
      monetized: monetized === 'any' ? null : (monetized === 'yes'),
    });
  }

  function reset() {
    setSearch('');
    setMinPrice('');
    setMaxPrice('');
    setSort('newest');
    setActiveTab('All');
    setPlatform('Any');
    setMinFollowers('');
    setMaxFollowers('');
    setMinViews('');
    setMaxViews('');
    setTopic('Any');
    setMonetized('any');
    onFilter && onFilter(null);
  }

  useEffect(() => {
    let mounted = true;
    getMeta().then(res => {
      if (!mounted) return;
      if (res.data && res.data.data && Array.isArray(res.data.data.platforms)) {
        setPlatformOptions(['Any', ...res.data.data.platforms]);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  return (
    <div className="filter-hero">
      <div className="filter-card">
        <div className="filter-tabs">
          {['All', 'Electronics', 'Fashion', 'Home', 'Other'].map(t => (
            <button
              key={t}
              className={"filter-tab" + (activeTab === t ? ' active' : '')}
              onClick={() => setActiveTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="filter-row">
          <input className="filter-input wide" placeholder="Search by name" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="filter-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest</option>
            <option value="price-asc">Price: Low → High</option>
            <option value="price-desc">Price: High → Low</option>
          </select>
        </div>

        <div className="filter-row metric-row">
          <div className="metric-group">
            <label>Platform</label>
            <select className="filter-select" value={platform} onChange={e => setPlatform(e.target.value)}>
              {platformOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <div className="range-inputs">
              <input placeholder="min" type="number" min="0" value={minFollowers} onChange={e => setMinFollowers(e.target.value)} />
              <span className="range-sep">—</span>
              <input placeholder="max" type="number" min="0" value={maxFollowers} onChange={e => setMaxFollowers(e.target.value)} />
            </div>
          </div>

          <div className="metric-group">
            <label>Avg views</label>
            <div className="range-inputs">
              <input placeholder="min" type="number" min="0" value={minViews} onChange={e => setMinViews(e.target.value)} />
              <span className="range-sep">—</span>
              <input placeholder="max" type="number" min="0" value={maxViews} onChange={e => setMaxViews(e.target.value)} />
            </div>
          </div>

          <div className="metric-group">
            <label>Topic</label>
            <select className="filter-select" value={topic} onChange={e => setTopic(e.target.value)}>
              <option>Any</option>
              <option>Gaming</option>
              <option>Fashion</option>
              <option>Tech</option>
              <option>Education</option>
              <option>Other</option>
            </select>
          </div>

          <div className="metric-group">
            <label>Monetized</label>
            <select className="filter-select" value={monetized} onChange={e => setMonetized(e.target.value)}>
              <option value="any">Any</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="range-group">
            <label>Price</label>
            <div className="range-inputs">
              <input placeholder="from" type="number" min="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} />
              <span className="range-sep">—</span>
              <input placeholder="to" type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} />
            </div>
          </div>

          <div className="filter-actions">
            <button className="btn btn-secondary" onClick={reset}>Reset</button>
            <button className="btn btn-primary" onClick={apply}>Search</button>
          </div>
        </div>
      </div>
    </div>
  );
}
