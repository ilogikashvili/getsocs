import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import App from '../App';
import reportWebVitals from '../reportWebVitals';
import '../index.css';
import '../assets/styles/market.css';
import '../css/responsive-overrides.css';
import '../css/auth-v2.css';

export default function AppProviders() {
  return (
    <React.StrictMode>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </React.StrictMode>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppProviders />);

reportWebVitals();
