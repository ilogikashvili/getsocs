import React, { useContext } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Home from '../pages/Home';
import Marketplace from '../pages/Marketplace';
import Policy from '../pages/Policy';
import ResetPassword from '../pages/ResetPassword';
import Login from '../pages/Login';
import Register from '../pages/Register';
import UploadProduct from '../pages/UploadProduct';
import ProductDetail from '../pages/ProductDetail';
import Messages from '../pages/Messages';
import Profile from '../pages/Profile';
import Favorites from '../pages/Favorites';
import Orders from '../pages/Orders';
import Cart from '../pages/Cart';
import Notifications from '../pages/Notifications';
import SellerProfile from '../pages/SellerProfile';
import Admin from '../pages/Admin';
import AdminChat from '../pages/AdminChat';
import ProtectedRoute from '../routes/ProtectedRoute';
import AuthContext from '../context/AuthContext';

export default function AppRoutes() {
  const { user } = useContext(AuthContext);
  const isAdminShell = user?.role === 'admin';

  return (
    <Routes>
      <Route path="/" element={isAdminShell ? <ProtectedRoute><Admin /></ProtectedRoute> : <Home />} />
      <Route path="/products" element={<Marketplace />} />
      <Route path="/policy" element={<Policy />} />
      <Route path="/support" element={<ProtectedRoute><Navigate to="/messages" replace state={{ openSupportChatId: 'new' }} /></ProtectedRoute>} />
      <Route path="/product/:id" element={<ProductDetail />} />
      <Route path="/users/:userId" element={<SellerProfile />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/register" element={<Register />} />
      <Route path="/upload" element={<ProtectedRoute><UploadProduct /></ProtectedRoute>} />
      <Route path="/messages" element={<ProtectedRoute><Messages /></ProtectedRoute>} />
      <Route path="/messages/:txId" element={<ProtectedRoute><Navigate to="/messages" replace /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/favorites" element={<ProtectedRoute><Favorites /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/settings" element={<Navigate to="/profile" replace />} />
      <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
      <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
      <Route path="/admin/chat/:chatId" element={<ProtectedRoute><AdminChat /></ProtectedRoute>} />
    </Routes>
  );
}
