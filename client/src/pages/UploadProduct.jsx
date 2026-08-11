import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import ProductForm from '../components/product/ProductForm';
import { getMyProducts } from '../services/productService';
import { getUploadUrl } from '../api/axios';

function formatPrice(value) {
  return `₾${Number(value || 0).toLocaleString()}`;
}

export default function UploadProduct() {
  const [listings, setListings] = useState([]);
  const [loadingListings, setLoadingListings] = useState(true);
  const [listingsError, setListingsError] = useState('');

  async function loadListings() {
    setLoadingListings(true);
    setListingsError('');
    try {
      const res = await getMyProducts();
      if (res.data?.success) {
        setListings(Array.isArray(res.data.data) ? res.data.data : []);
      } else {
        setListingsError(res.data?.error || 'Unable to load your listings.');
      }
    } catch (e) {
      setListingsError('Unable to load your listings.');
    } finally {
      setLoadingListings(false);
    }
  }

  useEffect(() => {
    loadListings();
  }, []);

  return (
    <div className="page-shell page-card">
      <section className="section-card">
        <h2>Upload a product</h2>
        <p>Share a new listing and keep it visible in your account dashboard.</p>
        <ProductForm onSuccess={() => loadListings()} />
      </section>

      <section className="section-card">
        <div className="panel-heading">
          <div>
            <h3>My listings</h3>
            <p>Review every product you have uploaded so far.</p>
          </div>
        </div>

        {listingsError && <div className="alert">{listingsError}</div>}
        {loadingListings ? (
          <div className="empty-state">Loading your listings...</div>
        ) : listings.length ? (
          <div className="seller-product-grid">
            {listings.map(product => (
              <Link key={product.id} className="seller-product-mini" to={`/product/${product.id}`}>
                <span>{product.platform || 'Listing'}</span>
                <strong>{product.title}</strong>
                <small>{formatPrice(product.price)} | {product.status || 'pending'}</small>
                {product.images?.[0] && (
                  <img src={getUploadUrl(product.images[0])} alt={product.title} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, marginTop: 10 }} />
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-state">You have not uploaded any listings yet.</div>
        )}
      </section>
    </div>
  );
}
