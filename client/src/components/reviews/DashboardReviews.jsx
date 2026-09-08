import React, { useCallback, useContext, useEffect, useState } from 'react';
import AuthContext from '../../context/AuthContext';
import { getDashboardReviews, submitReview } from '../../services/authService';

const VIRTUAL_TARGETS = { platform: 'platform', escrow: 'escrow-service' };

const SECTIONS = [
  {
    key: 'userToUser',
    type: 'seller',
    label: 'User \u2194 User',
    description: 'What buyers and sellers say about each other after a deal.',
    placeholder: null,
    empty: 'No buyer/seller reviews yet.'
  },
  {
    key: 'userToWebsite',
    type: 'platform',
    label: 'User \u2194 Website',
    description: 'Feedback on the GETSOCS marketplace experience itself.',
    placeholder: 'How has the marketplace worked for you?',
    empty: 'No reviews yet \u2014 be the first to share your experience.'
  },
  {
    key: 'userToEscrow',
    type: 'escrow',
    label: 'User \u2194 Escrow',
    description: 'How our escrow protection performed during real transactions.',
    placeholder: 'How did escrow handle your transaction?',
    empty: 'No reviews yet \u2014 be the first to share your experience.'
  }
];

function SectionIcon({ type }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', 'aria-hidden': 'true' };
  if (type === 'seller') {
    return (
      <svg {...common}>
        <circle cx="8.5" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
        <circle cx="16" cy="9.5" r="2.4" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3 20c.6-3.4 2.9-5.4 5.5-5.4S13.4 16.6 14 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        <path d="M14.6 14.9c2.3.2 4.1 2 4.6 5.1" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === 'platform') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
        <path d="M3.7 12h16.6M12 3.7c2.4 2.3 3.7 5.2 3.7 8.3s-1.3 6-3.7 8.3c-2.4-2.3-3.7-5.2-3.7-8.3s1.3-6 3.7-8.3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 3 19 6v5c0 4.4-2.8 7.3-7 10-4.2-2.7-7-5.6-7-10V6l7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Stars({ value, onChange }) {
  const interactive = typeof onChange === 'function';
  return (
    <span className={`dr-stars ${interactive ? 'interactive' : ''}`} role={interactive ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`dr-star ${n <= value ? 'filled' : ''}`}
          onClick={interactive ? () => onChange(n) : undefined}
          role={interactive ? 'radio' : undefined}
          aria-checked={interactive ? n === value : undefined}
        >
          ★
        </span>
      ))}
    </span>
  );
}

function initials(name = '') {
  return name.trim().slice(0, 2).toUpperCase() || '??';
}

function ReviewForm({ section, onSubmitted }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const targetId = section.type === 'platform' ? VIRTUAL_TARGETS.platform : VIRTUAL_TARGETS.escrow;
      await submitReview(targetId, rating, text.trim(), section.type);
      setText('');
      setDone(true);
      await onSubmitted();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to submit your review.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="dr-form" onSubmit={handleSubmit}>
      {error && <div className="alert">{error}</div>}
      {done && !error && <div className="review-thanks">Thanks for your feedback!</div>}
      <div className="dr-form-row">
        <span>Your rating:</span>
        <Stars value={rating} onChange={setRating} />
      </div>
      <textarea
        placeholder={section.placeholder}
        value={text}
        onChange={event => setText(event.target.value)}
        rows={2}
      />
      <button className="btn btn-secondary" type="submit" disabled={submitting}>
        {submitting ? 'Saving...' : 'Submit review'}
      </button>
    </form>
  );
}

function ReviewPanel({ section, bucket, loading, error, user, onSubmitted }) {
  const canWrite = user && section.type !== 'seller';

  return (
    <article className="dr-panel" aria-label={`${section.label} reviews`}>
      <div className="dr-panel-intro">
        <header className="dr-panel-head">
          <span className="dr-panel-icon"><SectionIcon type={section.type} /></span>
          <div>
            <h3>{section.label}</h3>
            <p>{section.description}</p>
          </div>
        </header>

        {bucket && bucket.count > 0 && (
          <div className="dr-summary">
            <Stars value={Math.round(bucket.average)} />
            <strong>{bucket.average.toFixed(1)}</strong>
            <span>({bucket.count} review{bucket.count === 1 ? '' : 's'})</span>
          </div>
        )}

        {canWrite && <ReviewForm section={section} onSubmitted={onSubmitted} />}
        {!canWrite && !user && section.type !== 'seller' && (
          <p className="dr-signin-hint">Sign in to leave a review here.</p>
        )}
      </div>

      <div className="dr-panel-list">
        {loading ? (
          <p className="reviews-empty">Loading reviews...</p>
        ) : error ? (
          <p className="reviews-empty">{error}</p>
        ) : !bucket || bucket.data.length === 0 ? (
          <p className="reviews-empty">{section.empty}</p>
        ) : (
          bucket.data.map(review => (
            <div key={review.id} className="dr-card">
              <div className="dr-card-head">
                <span className="dr-avatar">{initials(review.authorName)}</span>
                <div>
                  <strong>{review.authorName}</strong>
                  <span className="dr-date">{new Date(review.ts).toLocaleDateString()}</span>
                </div>
                <Stars value={review.rating} />
              </div>
              {review.text && <p className="dr-card-text">{review.text}</p>}
            </div>
          ))
        )}
      </div>
    </article>
  );
}

export default function DashboardReviews() {
  const auth = useContext(AuthContext);
  const user = auth?.user;

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await getDashboardReviews();
      if (res.data.success) setSummary(res.data);
    } catch (err) {
      setError('Unable to load reviews right now.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <section className="dashboard-reviews" aria-label="Community reviews">
      <header className="dashboard-reviews-header">
        <div>
          <h2>Community Reviews</h2>
          <p className="target-listings-subtitle">See what the community says about deals, the marketplace, and escrow \u2014 all in one place.</p>
        </div>
      </header>

      <div className="dr-panels">
        {SECTIONS.map(section => (
          <ReviewPanel
            key={section.key}
            section={section}
            bucket={summary?.[section.key]}
            loading={loading}
            error={error}
            user={user}
            onSubmitted={load}
          />
        ))}
      </div>
    </section>
  );
}
