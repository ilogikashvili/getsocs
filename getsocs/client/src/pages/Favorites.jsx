import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { getProducts } from '../services/productService';
import { getUploadUrl } from '../api/axios';

function getActionStorageKey(userId) {
  return `getsocs-actions-${userId}`;
}

function readFavorites(userId) {
  if (!userId) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(getActionStorageKey(userId)) || '{}');
    return Array.isArray(parsed.favorites) ? parsed.favorites : [];
  } catch (e) {
    return [];
  }
}

function writeFavorites(userId, favorites) {
  if (!userId) return;
  try {
    const current = JSON.parse(localStorage.getItem(getActionStorageKey(userId)) || '{}');
    localStorage.setItem(getActionStorageKey(userId), JSON.stringify({ ...current, favorites }));
  } catch (e) {
    localStorage.setItem(getActionStorageKey(userId), JSON.stringify({ favorites }));
  }
}

function formatPrice(value) {
  return `₾${Number(value || 0).toLocaleString()}`;
}

export default function Favorites() {
  const { user } = useContext(AuthContext);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadFavorites() {
      setLoading(true);
      setError('');
      if (!user?.id) {
        if (mounted) setProducts([]);
        if (mounted) setLoading(false);
        return;
      }

      const favoriteIds = readFavorites(user.id);
      try {
        const res = await getProducts();
        if (!mounted) return;
        if (!res.data?.success) {
          setError(res.data?.error || 'Unable to load favorites');
          return;
        }
        const allProducts = Array.isArray(res.data.data) ? res.data.data : [];
        setProducts(allProducts.filter(product => favoriteIds.includes(product.id)));
      } catch (e) {
        if (mounted) setError('Unable to load favorites');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadFavorites();
    return () => { mounted = false; };
  }, [user?.id]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2>Favorites</h2>
          <p>Keep track of listings you want to revisit later.</p>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {loading ? (
        <div className="empty-state">Loading favorites...</div>
      ) : products.length ? (
        <div className="seller-product-grid">
          {products.map(product => (
            <div key={product.id} className="seller-product-mini">
              <Link to={`/product/${product.id}`}>
                <span>{product.platform || 'Listing'}</span>
                <strong>{product.title}</strong>
                <small>{formatPrice(product.price)} | {product.followers || 0} followers</small>
                {product.images?.[0] && (
                  <img src={getUploadUrl(product.images[0])} alt={product.title} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, marginTop: 10 }} />
                )}
              </Link>
              <button
                type="button"
                className="btn secondary remove-saved-btn"
                onClick={() => {
                  const nextFavorites = readFavorites(user.id).filter(id => id !== product.id);
                  writeFavorites(user.id, nextFavorites);
                  setProducts(prev => prev.filter(item => item.id !== product.id));
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">You have no favorite listings yet.</div>
      )}
    </div>
  );
}
