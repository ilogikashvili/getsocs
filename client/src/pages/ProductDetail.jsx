import React, { useContext, useEffect, useState, useRef, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import axios from '../api/axios';
import { getProduct, getProducts, commentProduct, deleteProduct, claimProduct, submitProductClaim } from '../services/productService';
import { listTransactions } from '../services/transactionService';
import ReviewsSection from '../components/reviews/ReviewsSection';
import { getUploadUrl } from '../api/axios';

const EMPTY_ACTIONS = { favorites: [], saved: [], follows: [] };

function formatFollowers(value) {
  const count = Number(value) || 0;
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}k`;
  return `${count}`;
}

function formatPrice(value) {
  return `₾${Number(value || 0).toLocaleString()}`;
}

function getSellerInitials(seller, fallback) {
  const label = seller?.username || fallback || 'NA';
  return String(label).slice(0, 2).toUpperCase();
}

function getCommentName(comment) {
  return comment?.username || comment?.userName || comment?.userId || 'Member';
}

function getCommentInitials(comment) {
  const label = String(getCommentName(comment)).trim() || 'Member';
  const parts = label.split(/\s+/).filter(Boolean);
  const initials = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : label.slice(0, 2);
  return initials.toUpperCase();
}

function getCommentPhotoUrl(comment) {
  const photo = comment?.profilePhoto || comment?.userProfilePhoto || comment?.avatar || '';
  return photo ? getUploadUrl(photo) : '';
}

function getActionStorageKey(userId) {
  return `getsocs-actions-${userId}`;
}

function readActions(userId) {
  if (!userId) return EMPTY_ACTIONS;
  try {
    const parsed = JSON.parse(localStorage.getItem(getActionStorageKey(userId)) || '{}');
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      saved: Array.isArray(parsed.saved) ? parsed.saved : [],
      follows: Array.isArray(parsed.follows) ? parsed.follows : []
    };
  } catch (e) {
    return EMPTY_ACTIONS;
  }
}

function writeActions(userId, actions) {
  localStorage.setItem(getActionStorageKey(userId), JSON.stringify(actions));
}

function toggleValue(list, value) {
  return list.includes(value) ? list.filter(item => item !== value) : [...list, value];
}

export default function ProductDetail() {
  const { user } = useContext(AuthContext);
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [sellerProducts, setSellerProducts] = useState([]);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimCode, setClaimCode] = useState('');
  const [claimStep, setClaimStep] = useState('start'); // start -> code -> submitted
  const [claimError, setClaimError] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [canReviewSeller, setCanReviewSeller] = useState(false);
  const [reviewTransactionId, setReviewTransactionId] = useState(null);
  const [notice, setNotice] = useState('');
  const [actions, setActions] = useState(EMPTY_ACTIONS);

  // Carousel state (hooks must be declared unconditionally)
  const galleryImages = useMemo(() => 
    product?.images?.length ? product.images : product?.image ? [product.image] : [],
    [product?.images, product?.image]
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0); // 0..1
  const progressRef = useRef(null);
  const autoplayMs = 5000; // 5 seconds per image

  useEffect(() => {
    let mounted = true;

    async function loadProduct() {
      setLoading(true);
      setError('');
      try {
        const res = await getProduct(id);
        if (!mounted) return;
        if (!res.data.success) {
          setError(res.data.error || 'Unable to load product');
          return;
        }

        const loadedProduct = res.data.data;
        setProduct(loadedProduct);

        const sellerId = loadedProduct.seller?.id || loadedProduct.sellerId;
        if (sellerId) {
          const sellerRes = await getProducts({ sellerId });
          if (!mounted) return;
          const products = sellerRes.data.success ? (sellerRes.data.data || []) : [];
          setSellerProducts(products.filter(item => item.id !== loadedProduct.id).slice(0, 3));
        }
      } catch (e) {
        if (mounted) setError('Unable to load product');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProduct();
    return () => { mounted = false; };
  }, [id]);

  useEffect(() => {
    if (user?.id) setActions(readActions(user.id));
    else setActions(EMPTY_ACTIONS);
  }, [user?.id]);

  useEffect(() => {
    let mounted = true;
    async function checkReviewEligibility() {
      if (!user || !product) { setCanReviewSeller(false); setReviewTransactionId(null); return; }
      const sellerId = product.sellerId;
      if (!sellerId || sellerId === user.id) { setCanReviewSeller(false); setReviewTransactionId(null); return; }
      try {
        const res = await listTransactions();
        if (!mounted) return;
        const txs = res.data.success ? (res.data.data || []) : [];
        const completedDeal = txs.find(tx => tx.status === 'completed' && tx.sellerId === sellerId && tx.buyerId === user.id);
        setCanReviewSeller(!!completedDeal);
        setReviewTransactionId(completedDeal ? completedDeal.id : null);
      } catch (e) {
        if (mounted) { setCanReviewSeller(false); setReviewTransactionId(null); }
      }
    }
    checkReviewEligibility();
    return () => { mounted = false; };
  }, [user, product]);

  // Carousel autoplay and progress handling
  useEffect(() => {
    setCurrentIndex(0);
    setProgress(0);
  }, [id]);

  useEffect(() => {
    if (!galleryImages || galleryImages.length <= 1) return undefined;

    let mounted = true;
    const tickMs = 100;
    clearInterval(progressRef.current);
    setProgress(0);
    progressRef.current = setInterval(() => {
      if (!mounted) return;
      setProgress(prev => {
        const next = prev + tickMs / autoplayMs;
        if (next >= 1) {
          // advance to the right (decrement index)
          setCurrentIndex(ci => (ci - 1 + galleryImages.length) % galleryImages.length);
          return 0;
        }
        return next;
      });
    }, tickMs);

    return () => { mounted = false; clearInterval(progressRef.current); };
  }, [galleryImages]);

  function goToIndex(i) {
    if (!galleryImages || !galleryImages.length) return;
    const len = galleryImages.length;
    setCurrentIndex(((i % len) + len) % len);
    setProgress(0);
  }

  function nextImage() { goToIndex(currentIndex + 1); }
  function prevImage() { goToIndex(currentIndex - 1); }

  function handleBuy() {
    setError('');
    if (!user) return navigate('/login');
    const sellerId = product?.seller?.id || product?.sellerId;
    if (!sellerId) return setError('Seller not available');

    (async () => {
      try {
        const res = await axios.post(`/chats/direct/${sellerId}`);
        if (res.data?.success && res.data?.chat) {
          navigate('/messages', { state: { openDirectChatId: res.data.chat.id } });
        } else {
          navigate('/messages');
        }
      } catch (e) {
        navigate('/messages');
      }
    })();
  }

  async function handleStartClaim() {
    if (!user) return navigate('/login');
    setClaimError('');
    setClaimLoading(true);
    setShowClaimModal(true);
    try {
      const res = await claimProduct(id);
      if (res.data.success) {
        setClaimCode(res.data.data.code);
        setClaimStep('code');
      } else {
        setClaimError(res.data.error || 'Unable to start a claim for this listing.');
      }
    } catch (e) {
      setClaimError(e.response?.data?.error || 'Unable to start a claim for this listing.');
    } finally {
      setClaimLoading(false);
    }
  }

  async function handleSubmitClaim() {
    setClaimLoading(true);
    setClaimError('');
    try {
      const res = await submitProductClaim(id);
      if (res.data.success) {
        setClaimStep('submitted');
      } else {
        setClaimError(res.data.error || 'Unable to submit your claim.');
      }
    } catch (e) {
      setClaimError(e.response?.data?.error || 'Unable to submit your claim.');
    } finally {
      setClaimLoading(false);
    }
  }

  function requireUserAction(action) {
    if (!user) {
      navigate('/login');
      return false;
    }
    action();
    return true;
  }

  function toggleProductAction(type) {
    requireUserAction(() => {
      const label = type === 'favorites' ? 'favorite' : 'saved';
      setActions(prev => {
        const next = { ...prev, [type]: toggleValue(prev[type], product.id) };
        writeActions(user.id, next);
        setNotice(next[type].includes(product.id)
          ? `Product added to ${label} list.`
          : `Product removed from ${label} list.`);
        return next;
      });
    });
  }

  function toggleFollowSeller() {
    const sellerId = product?.seller?.id || product?.sellerId;
    if (!sellerId) return;

    requireUserAction(() => {
      setActions(prev => {
        const next = { ...prev, follows: toggleValue(prev.follows, sellerId) };
        writeActions(user.id, next);
        setNotice(next.follows.includes(sellerId) ? 'Seller followed.' : 'Seller unfollowed.');
        return next;
      });
    });
  }

  async function handleComment(e) {
    e.preventDefault();
    if (!user) return navigate('/login');
    try {
      const res = await commentProduct(id, comment);
      if (res.data.success) {
        setProduct(prev => ({ ...prev, comments: [...(prev?.comments || []), res.data.comment] }));
        setComment('');
      } else {
        setError(res.data.error || 'Could not add comment');
      }
    } catch (e) {
      setError('Could not add comment');
    }
  }

  async function handleRemove() {
    if (!window.confirm('Remove this product permanently?')) return;
    try {
      const res = await deleteProduct(id);
      if (res.data.success) {
        navigate('/');
      } else {
        setError(res.data.error || 'Unable to remove product');
      }
    } catch (e) {
      setError('Unable to remove product');
    }
  }

  if (loading) return <div className="page-shell"><div className="empty-state">Loading product...</div></div>;
  if (!product) return <div className="page-shell"><div className="empty-state">Product not found.</div></div>;

  const seller = product.seller || {};
  const sellerId = seller.id || product.sellerId;
  const sellerName = seller.username || product.sellerId || 'Unknown seller';
  const sellerPhotoUrl = seller.profilePhoto ? getUploadUrl(seller.profilePhoto) : '';
  const isFavorite = actions.favorites.includes(product.id);
  const isSaved = actions.saved.includes(product.id);
  const isFollowing = sellerId ? actions.follows.includes(sellerId) : false;

  return (
    <div className="page-shell product-detail-page">
      {error && <div className="alert">{error}</div>}
      {notice && (
        <div className="profile-toast product-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice('')}>Close</button>
        </div>
      )}

      <section className="product-deal-layout">
        <div className="product-visual-panel">
          <div className="product-gallery product-gallery-large">
            {galleryImages.length ? (
              <div className="carousel">
                <button className="carousel-btn left" type="button" onClick={prevImage} aria-label="Previous image">‹</button>
                <div className="carousel-viewport">
                  <img
                    className="product-image"
                    src={getUploadUrl(galleryImages[currentIndex])}
                    alt={`${product.title} ${currentIndex + 1}`}
                    onError={e => { e.target.onerror = null; e.target.src = '/getsocs-logo.png'; }}
                  />
                </div>
                <button className="carousel-btn right" type="button" onClick={nextImage} aria-label="Next image">›</button>

                <div className="carousel-thumbs">
                  {galleryImages.map((img, index) => (
                    <button
                      key={img + index}
                      type="button"
                      className={`carousel-thumb ${index === currentIndex ? 'active' : ''}`}
                      onClick={() => goToIndex(index)}
                      style={{ opacity: index === currentIndex ? 1 : 0.45 }}
                      aria-label={`Show image ${index + 1}`}
                    >
                      <img src={getUploadUrl(img)} alt={`thumb ${index + 1}`} onError={e => { e.target.onerror = null; e.target.src = '/getsocs-logo.png'; }} />
                      <div className="thumb-progress" style={{ width: index === currentIndex ? `${Math.round(progress * 100)}%` : '0%' }} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="product-image-placeholder">
                <span>{String(product.platform || 'GS').slice(0, 2).toUpperCase()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="product-info-panel">
          <div className="product-meta-row">
            <span>Listed {new Date(product.createdAt).toLocaleDateString()}</span>
            <span>{formatFollowers(product.followers)} followers</span>
            <span>{product.status || 'approved'}</span>
          </div>

          <h2>{product.title}</h2>
          <p className="product-platform-line">{product.topic || 'Marketplace'} | {product.platform || 'Social account'}</p>

          <div className="product-metrics">
            <div><strong>{formatFollowers(product.followers)}</strong><span>followers</span></div>
            <div><strong>{formatFollowers(product.avgViews || 0)}</strong><span>avg views</span></div>
            <div><strong>{product.monetized ? 'Yes' : 'No'}</strong><span>monetized</span></div>
          </div>

          {user ? (
            <p className="product-detail-description">{product.description || 'No description available.'}</p>
          ) : (
            <p className="product-detail-description product-detail-locked">
              <Link to="/login">Sign in</Link> to view the full description.
            </p>
          )}

          <div className="product-price-row">
            <strong>{formatPrice(product.price)}</strong>
            <div className="product-action-row">
              <button className="btn primary" type="button" onClick={handleBuy}>Buy this account</button>
              <button
                className={`btn secondary product-toggle ${isFavorite ? 'active' : ''}`}
                type="button"
                onClick={() => toggleProductAction('favorites')}
              >
                {isFavorite ? 'Favorited' : 'Favorite'}
              </button>
              <button
                className={`btn secondary product-toggle ${isSaved ? 'active' : ''}`}
                type="button"
                onClick={() => toggleProductAction('saved')}
              >
                {isSaved ? 'Saved' : 'Save'}
              </button>
              {user && product.sellerId !== user.id && (
                <button className="btn secondary claim-ownership-btn" type="button" onClick={handleStartClaim}>
                  This channel is mine
                </button>
              )}
            </div>
          </div>

          {product.code && <p className="product-code">Product code: <strong>{product.code}</strong></p>}
        </div>

        <aside className="seller-detail-card">
          {user ? (
            <Link className="seller-profile-link" to={`/users/${sellerId}`}>
              <div className="seller-profile-avatar">
                {sellerPhotoUrl ? <img src={sellerPhotoUrl} alt={sellerName} /> : getSellerInitials(seller, product.sellerId)}
              </div>
              <div>
                <strong>{sellerName}</strong>
                <span>{product.sellerMembership?.name || seller.membership?.name || 'Marketplace seller'}</span>
              </div>
            </Link>
          ) : (
            <div className="seller-profile-link seller-profile-locked">
              <div className="seller-profile-avatar">?</div>
              <div>
                <strong><Link to="/login">Sign in</Link> to see the seller</strong>
                <span>Marketplace seller</span>
              </div>
            </div>
          )}

          <div className="seller-score-row">
            <div><strong>{formatPrice(product.price)}</strong><span>listing price</span></div>
            <div><strong>{sellerProducts.length + 1}</strong><span>live listings</span></div>
          </div>

          <button className="btn primary" type="button" onClick={handleBuy}>Contact seller</button>
          <button
            className={`btn secondary product-toggle ${isFollowing ? 'active' : ''}`}
            type="button"
            onClick={toggleFollowSeller}
          >
            {isFollowing ? 'Following seller' : 'Follow seller'}
          </button>
          <Link className="btn secondary" to={`/users/${sellerId}`}>View profile</Link>
        </aside>
      </section>

      <section className="product-lower-grid">
        <div className="section-card">
          <h3>Description</h3>
          <div className="product-description-list">
            <div><span>Platform</span><strong>{product.platform || 'Other'}</strong></div>
            <div><span>Topic</span><strong>{product.topic || 'Other'}</strong></div>
            <div><span>Status</span><strong>{product.status || 'approved'}</strong></div>
            <div><span>Revenue state</span><strong>{product.monetized ? 'Monetized' : 'Unmonetized'}</strong></div>
          </div>
        </div>

        <div className="section-card comments-card">
          <h3>Comments</h3>
          {product.comments?.length ? (
            <div className="comment-list">
              {product.comments.map(c => {
                const commentPhotoUrl = getCommentPhotoUrl(c);
                const commentName = getCommentName(c);
                return (
                  <article key={c.id} className="comment-row">
                    <div className="comment-avatar" aria-hidden="true">
                      {commentPhotoUrl ? (
                        <img src={commentPhotoUrl} alt="" />
                      ) : (
                        <span>{getCommentInitials(c)}</span>
                      )}
                    </div>
                    <div className="comment-content">
                      <div className="comment-meta">
                        <strong>{commentName}</strong>
                        <small>{new Date(c.ts).toLocaleString()}</small>
                      </div>
                      <p>{c.text}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">No comments yet.</div>
          )}
          {user && (
            <form onSubmit={handleComment} className="comment-form">
              <div className="comment-composer">
                <div className="comment-avatar comment-avatar-self" aria-hidden="true">
                  {user.profilePhoto ? (
                    <img src={getUploadUrl(user.profilePhoto)} alt="" />
                  ) : (
                    <span>{getCommentInitials({ username: user.username || user.name || user.id })}</span>
                  )}
                </div>
                <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Leave a question or note" rows={3} />
              </div>
              <button type="submit" className="btn primary" disabled={!comment.trim()}>Post comment</button>
            </form>
          )}
        </div>
      </section>

      {user ? (
        <section className="section-card seller-products-section">
          <div className="panel-heading">
            <div>
              <h3>More from {sellerName}</h3>
              <p>{isFollowing ? 'You follow this seller.' : 'Follow this seller to keep their listings easy to find.'}</p>
            </div>
            <Link className="btn secondary" to={`/users/${sellerId}`}>Seller profile</Link>
          </div>

          <div className="seller-product-grid">
            {sellerProducts.length ? sellerProducts.map(item => (
              <Link key={item.id} className="seller-product-mini" to={`/product/${item.id}`}>
                <span>{item.platform || 'Listing'}</span>
                <strong>{item.title}</strong>
                <small>{formatPrice(item.price)} | {formatFollowers(item.followers)} followers</small>
              </Link>
            )) : (
              <div className="empty-state">No other live listings from this seller yet.</div>
            )}
          </div>
        </section>
      ) : (
        <section className="section-card seller-products-section">
          <div className="panel-heading">
            <div>
              <h3>More from this seller</h3>
              <p><Link to="/login">Sign in</Link> to see the seller's other listings.</p>
            </div>
          </div>
        </section>
      )}

      {user && (user.role === 'admin' || user.role === 'escrow') && (
        <button className="btn btn-danger" onClick={handleRemove}>Remove product</button>
      )}

      {product.sellerId && (
        <ReviewsSection
          targetId={product.sellerId}
          type="seller"
          currentUserId={user?.id}
          canReview={canReviewSeller}
          transactionId={reviewTransactionId}
          title="Seller reviews"
        />
      )}

      {showClaimModal && (
        <div className="modal-backdrop" onClick={() => !claimLoading && setShowClaimModal(false)}>
          <div className="modal-card claim-ownership-modal" onClick={e => e.stopPropagation()}>
            <h4>Claim ownership of &quot;{product.title}&quot;</h4>
            {claimError && <div className="alert">{claimError}</div>}

            {claimStep === 'code' && (
              <>
                <p className="payment-modal-summary">
                  Add this code to the channel&apos;s bio or description to prove you own it, then come back and submit for review.
                </p>
                <div className="claim-code-box">{claimCode}</div>
                <div className="modal-actions">
                  <button className="btn btn-secondary" type="button" disabled={claimLoading} onClick={() => setShowClaimModal(false)}>Close</button>
                  <button className="btn btn-primary" type="button" disabled={claimLoading} onClick={handleSubmitClaim}>
                    {claimLoading ? 'Submitting...' : "I've added the code - submit for review"}
                  </button>
                </div>
              </>
            )}

            {claimStep === 'submitted' && (
              <>
                <p className="payment-modal-summary">
                  Your claim has been submitted. Our escrow team will verify the code on the channel and remove this
                  listing if your claim checks out, freeing you to list it yourself.
                </p>
                <div className="modal-actions">
                  <button className="btn btn-primary" type="button" onClick={() => setShowClaimModal(false)}>Done</button>
                </div>
              </>
            )}

            {claimStep === 'start' && claimLoading && <p className="payment-modal-summary">Requesting a verification code...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
