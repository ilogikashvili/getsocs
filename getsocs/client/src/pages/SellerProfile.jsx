import React, { useContext, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { getPublicProfile } from '../services/authService';
import { getProducts } from '../services/productService';
import { getUploadUrl } from '../api/axios';

function formatFollowers(value) {
  const count = Number(value) || 0;
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${Math.round(count / 1000)}k`;
  return `${count}`;
}

function formatPrice(value) {
  return `₾${Number(value || 0).toLocaleString()}`;
}

function getDisplayName(profile) {
  const fullName = `${profile?.name || ''} ${profile?.lastname || ''}`.trim();
  return fullName || profile?.username || 'Getsocs seller';
}

function getInitials(profile) {
  return getDisplayName(profile)
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function readActions(userId) {
  if (!userId) return { follows: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(`getsocs-actions-${userId}`) || '{}');
    return { follows: Array.isArray(parsed.follows) ? parsed.follows : [] };
  } catch (e) {
    return { follows: [] };
  }
}

function writeFollow(userId, sellerId, following) {
  const current = JSON.parse(localStorage.getItem(`getsocs-actions-${userId}`) || '{}');
  const follows = Array.isArray(current.follows) ? current.follows : [];
  const nextFollows = following ? follows.filter(id => id !== sellerId) : [...follows, sellerId];
  localStorage.setItem(`getsocs-actions-${userId}`, JSON.stringify({ ...current, follows: nextFollows }));
  return nextFollows.includes(sellerId);
}

export default function SellerProfile() {
  const { user } = useContext(AuthContext);
  const { userId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadSeller() {
      setLoading(true);
      setError('');
      try {
        const [profileRes, productsRes] = await Promise.all([
          getPublicProfile(userId),
          getProducts({ sellerId: userId })
        ]);

        if (!mounted) return;
        if (profileRes.data.success) setProfile(profileRes.data.data);
        else setError(profileRes.data.error || 'Unable to load seller profile');
        if (productsRes.data.success) setProducts(productsRes.data.data || []);
      } catch (e) {
        if (mounted) setError('Unable to load seller profile');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadSeller();
    return () => { mounted = false; };
  }, [userId]);

  useEffect(() => {
    setFollowing(readActions(user?.id).follows.includes(userId));
  }, [user?.id, userId]);

  function handleFollow() {
    if (!user) return navigate('/login');
    setFollowing(writeFollow(user.id, userId, following));
  }

  if (loading) return <div className="page-shell"><div className="empty-state">Loading seller profile...</div></div>;
  if (!profile) return <div className="page-shell"><div className="empty-state">Seller not found.</div></div>;

  const profilePhotoUrl = profile.profilePhoto ? getUploadUrl(profile.profilePhoto) : '';
  const backgroundStyle = profile.backgroundPhoto
    ? { backgroundImage: `linear-gradient(90deg, rgba(8,13,24,0.9), rgba(8,13,24,0.72)), url(${getUploadUrl(profile.backgroundPhoto)})` }
    : undefined;
  const totalFollowers = products.reduce((sum, item) => sum + (Number(item.followers) || 0), 0);
  const avgPrice = products.length
    ? Math.round(products.reduce((sum, item) => sum + (Number(item.price) || 0), 0) / products.length)
    : 0;

  return (
    <div className="page-shell seller-profile-page">
      {error && <div className="alert">{error}</div>}

      <section className="seller-profile-hero" style={backgroundStyle}>
        <div className="seller-profile-main">
          <div className="seller-profile-photo">
            {profilePhotoUrl ? <img src={profilePhotoUrl} alt={profile.username} /> : <span>{getInitials(profile)}</span>}
          </div>
          <div>
            <div className="profile-kicker">Seller profile</div>
            <h2>{profile.username}</h2>
            <p>{getDisplayName(profile)}</p>
            <div className="seller-profile-tags">
              {profile.membership && <span>{profile.membership.name}</span>}
              {profile.idVerified && <span>✅ ID Verified</span>}
              {profile.buyerVerified && <span>Buyer checked</span>}
            </div>
          </div>
        </div>

        <div className="seller-profile-actions">
          <button className={`btn primary ${following ? 'is-following' : ''}`} type="button" onClick={handleFollow}>
            {following ? 'Following' : 'Follow seller'}
          </button>
          <Link className="btn secondary" to="/messages">Messages</Link>
        </div>
      </section>

      <section className="profile-stats-grid seller-stats-grid">
        <div className="profile-stat"><strong>{products.length}</strong><span>live listings</span></div>
        <div className="profile-stat"><strong>{formatFollowers(totalFollowers)}</strong><span>total followers</span></div>
        <div className="profile-stat"><strong>{formatPrice(avgPrice)}</strong><span>avg price</span></div>
        <div className="profile-stat"><strong>{formatPrice(profile.sellerInfo?.pointsSold || 0)}</strong><span>sold volume</span></div>
      </section>

      <section className="section-card">
        <div className="panel-heading">
          <div>
            <h3>Seller listings</h3>
            <p>Browse other products from this seller.</p>
          </div>
        </div>

        <div className="seller-profile-listings">
          {products.length ? products.map(item => (
            <Link key={item.id} className="seller-profile-listing-card" to={`/product/${item.id}`}>
              <span>{item.platform || 'Listing'}</span>
              <strong>{item.title}</strong>
              <p>{item.description}</p>
              <small>{formatPrice(item.price)} | {formatFollowers(item.followers)} followers</small>
            </Link>
          )) : (
            <div className="empty-state">This seller has no live listings yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
