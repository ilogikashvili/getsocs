import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthContext from '../context/AuthContext';
import Login from './Login';

function renderLogin(overrides = {}) {
  const value = {
    login: jest.fn().mockResolvedValue({ ok: false, error: 'Login failed.' }),
    completeTwoFactor: jest.fn(),
    resendTwoFactorCode: jest.fn(),
    completeEmailVerification: jest.fn(),
    resendEmailVerificationCode: jest.fn(),
    ...overrides
  };
  render(
    <MemoryRouter>
      <AuthContext.Provider value={value}>
        <Login />
      </AuthContext.Provider>
    </MemoryRouter>
  );
  return value;
}

describe('Login', () => {
  test('submits username/password and surfaces an API failure', async () => {
    const ctx = renderLogin({ login: jest.fn().mockResolvedValue({ ok: false, error: 'Invalid credentials' }) });
    fireEvent.change(screen.getByPlaceholderText('Enter your username or email'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(ctx.login).toHaveBeenCalledWith('alice', 'wrong'));
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });

  test('moves to the 2FA step when the backend requires it', async () => {
    renderLogin({
      login: jest.fn().mockResolvedValue({ ok: false, requires2FA: true, userId: 'u-1', message: 'Code sent' })
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your username or email'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'Correct123!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Verify your identity')).toBeInTheDocument();
    expect(screen.getByText('Code sent')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('000000')).toBeInTheDocument();
  });

  test('offers email verification for an unverified account', async () => {
    renderLogin({
      login: jest.fn().mockResolvedValue({ ok: false, requiresEmailVerification: true, email: 'alice@example.com' })
    });
    fireEvent.change(screen.getByPlaceholderText('Enter your username or email'), { target: { value: 'alice' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'Correct123!' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Verify your email')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
  });
});
