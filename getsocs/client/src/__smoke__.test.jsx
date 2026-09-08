import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import App from './App';

test.each(['/', '/products'])('renders %s without throwing', (route) => {
  const errors = [];
  const originalError = console.error;
  console.error = (...args) => {
    errors.push(args.map(String).join(' '));
    originalError(...args);
  };

  render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>
  );

  console.error = originalError;

  const fatalErrors = errors.filter(msg =>
    !msg.includes('not wrapped in act') &&
    !msg.includes('AggregateError') &&
    !msg.toLowerCase().includes('network error') &&
    !msg.includes('ReactDOMTestUtils.act')
  );

  if (fatalErrors.length) {
    throw new Error('Unexpected console.error during render:\n' + fatalErrors.join('\n---\n'));
  }
});
