import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import App from '../App';
import reportWebVitals from '../reportWebVitals';
import '../index.css';
import '../assets/styles/market.css';
import '../css/responsive-overrides.css';
import '../css/auth-v2.css';
import '../css/theme.css';
import '../css/product-cards.css';

export default function AppProviders() {
  return (
    <React.StrictMode>
      <ThemeProvider>
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </React.StrictMode>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<AppProviders />);

reportWebVitals();
