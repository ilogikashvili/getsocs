import React, { useContext, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { listTransactions } from '../services/transactionService';

function formatPrice(value) {
  return `₾${Number(value || 0).toLocaleString()}`;
}

export default function Orders() {
  const { user } = useContext(AuthContext);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadOrders() {
      setLoading(true);
      setError('');
      try {
        const res = await listTransactions();
        if (!mounted) return;
        if (!res.data?.success) {
          setError(res.data?.error || 'Unable to load orders');
          return;
        }
        setTransactions(Array.isArray(res.data.data) ? res.data.data : []);
      } catch (e) {
        if (mounted) setError('Unable to load orders');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadOrders();
    return () => { mounted = false; };
  }, [user?.id]);

  return (
    <div className="page-shell">
      <div className="page-header">
        <div>
          <h2>Orders</h2>
          <p>Review your purchases and order progress.</p>
        </div>
      </div>

      {error && <div className="alert">{error}</div>}
      {loading ? (
        <div className="empty-state">Loading orders...</div>
      ) : transactions.length ? (
        <div className="section-card">
          {transactions.map(tx => (
            <div key={tx.id} className="transaction-row">
              <div>
                <strong>{tx.productTitle || 'Listing'}</strong>
                <div>Status: <span className={`status-pill status-${tx.status}`}>{tx.status}</span></div>
                <div>Price: {formatPrice(tx.productPrice)}</div>
              </div>
              <Link className="btn btn-primary" to={`/messages/${tx.id}`}>Open order</Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">You have no orders yet.</div>
      )}
    </div>
  );
}
