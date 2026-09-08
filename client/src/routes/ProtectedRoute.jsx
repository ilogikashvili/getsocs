import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import AuthContext from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { token, initialized } = useContext(AuthContext);
  if (!initialized) {
    return <div className="page-shell"><div className="empty-state">Loading authentication...</div></div>;
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
