import React, { useCallback, useContext, useEffect, useState } from 'react';
import { getUserReviews, submitReview, editReview, deleteReview } from '../../services/authService';
import AuthContext from '../../context/AuthContext';
import { Edit3, Trash2 } from 'lucide-react';

function Stars({ value, onChange }) {
  const interactive = typeof onChange === 'function';
  return (
    <span className="review-stars" role={interactive ? 'radiogroup' : undefined} aria-label="Rating">
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`review-star ${n <= value ? 'filled' : ''} ${interactive ? 'interactive' : ''}`}
          onClick={interactive ? () => onChange(n) : undefined}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/**
 * targetId: the user being reviewed (seller, buyer, or escrow)
 * type: 'seller' | 'buyer' | 'escrow'
 * currentUserId: the logged-in viewer's id (or null)
 * canReview: whether the viewer is allowed to leave a review right now
 * title: heading text for the section
 */
export default function ReviewsSection({ targetId, type = 'seller', currentUserId, canReview = false, transactionId = null, title = 'Reviews' }) {
  const [reviews, setReviews] = useState([]);
  const [average, setAverage] = useState(0);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [editingReviewId, setEditingReviewId] = useState(null);
  const [editingReviewText, setEditingReviewText] = useState('');
  const [editingReviewRating, setEditingReviewRating] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const { user } = useContext(AuthContext);

  const load = useCallback(async () => {
    if (!targetId) return;
    setLoading(true);
    try {
      const res = await getUserReviews(targetId);
      if (res.data.success) {
        const all = res.data.data || [];
        setReviews(all.filter(r => r.type === type));
        setAverage(res.data.average || 0);
        setCount(res.data.count || 0);
      }
    } catch (e) {
      // silent - reviews are supplementary content
    } finally {
      setLoading(false);
    }
  }, [targetId, type]);

  useEffect(() => { load(); }, [load]);

  const myExistingReview = reviews.find(r => r.authorId === currentUserId);
  const isModerator = user?.role === 'admin' || user?.role === 'escrow';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await submitReview(targetId, rating, text.trim(), type, transactionId);
      setText('');
      setDone(true);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to submit review.');
    } finally {
      setSubmitting(false);
    }
  }

  function startEditReview(review) {
    setEditingReviewId(review.id);
    setEditingReviewText(review.text || '');
    setEditingReviewRating(review.rating || 5);
    setEditing(true);
  }

  function cancelEditReview() {
    setEditingReviewId(null);
    setEditingReviewText('');
    setEditingReviewRating(5);
    setEditing(false);
  }

  async function saveEditReview(reviewId) {
    if (!editingReviewText.trim()) {
      setError('Review text cannot be empty.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const res = await editReview(reviewId, editingReviewRating, editingReviewText.trim());
      if (res.data.success) {
        cancelEditReview();
        await load();
      } else {
        setError(res.data.error || 'Unable to update review.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to update review.');
    } finally {
      setSubmitting(false);
    }
  }

  async function removeReview(reviewId) {
    setError('');
    setSubmitting(true);
    try {
      const res = await deleteReview(reviewId);
      if (res.data.success) {
        await load();
      } else {
        setError(res.data.error || 'Unable to delete review.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Unable to delete review.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!targetId) return null;

  return (
    <section className="reviews-section">
      <div className="reviews-header">
        <h3>{title}</h3>
        {count > 0 && (
          <div className="reviews-summary">
            <Stars value={Math.round(average)} />
            <strong>{average.toFixed(1)}</strong>
            <span>({count} review{count === 1 ? '' : 's'})</span>
          </div>
        )}
      </div>

      {canReview && currentUserId && (
        <form className="review-form" onSubmit={handleSubmit}>
          {error && <div className="alert">{error}</div>}
          {done && !error && <div className="review-thanks">Thanks for your review!</div>}
          <div className="review-form-row">
            <span>Your rating:</span>
            <Stars value={rating} onChange={setRating} />
          </div>
          <textarea
            placeholder={myExistingReview ? 'Update your review...' : 'Share how the deal went...'}
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
          />
          <button className="btn btn-secondary" type="submit" disabled={submitting}>
            {submitting ? 'Saving...' : myExistingReview ? 'Update review' : 'Submit review'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="reviews-empty">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <p className="reviews-empty">No reviews yet.</p>
      ) : (
        <div className="reviews-list">
          {reviews.map(r => {
            const isOwner = r.authorId === currentUserId;
            const canDelete = isOwner || isModerator;
            const canEdit = isOwner && !editing;
            const isEditing = editingReviewId === r.id;
            return (
              <div key={r.id} className="review-item">
                <div className="review-item-head review-item-head-with-actions">
                  <div>
                    <strong>{r.authorName}</strong>
                    <Stars value={r.rating} />
                    <span className="review-date">{new Date(r.ts).toLocaleDateString()}</span>
                  </div>
                  {(canEdit || canDelete) && (
                    <div className="review-actions">
                      {canEdit && !isEditing && (
                        <button type="button" className="link-btn" onClick={() => startEditReview(r)}>
                          <Edit3 size={14} /> Edit
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" className="link-btn" onClick={() => removeReview(r.id)}>
                          <Trash2 size={14} /> Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
                {isEditing ? (
                  <div className="review-edit-panel">
                    <div className="review-form-row">
                      <span>Rating:</span>
                      <Stars value={editingReviewRating} onChange={setEditingReviewRating} />
                    </div>
                    <textarea
                      value={editingReviewText}
                      onChange={e => setEditingReviewText(e.target.value)}
                      rows={3}
                    />
                    <div className="review-edit-actions">
                      <button type="button" className="btn secondary" onClick={cancelEditReview} disabled={submitting}>
                        Cancel
                      </button>
                      <button type="button" className="btn primary" onClick={() => saveEditReview(r.id)} disabled={submitting || !editingReviewText.trim()}>
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  r.text && <p className="review-text">{r.text}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
