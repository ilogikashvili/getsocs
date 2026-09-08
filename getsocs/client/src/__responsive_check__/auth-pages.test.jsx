import React from 'react';
import { render, screen, act, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import Login from '../pages/Login';
import Register from '../pages/Register';
import ResetPassword from '../pages/ResetPassword';

function renderWithProviders(ui, initialEntries = ['/login']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>
  );
}

describe('Redesigned auth pages — render + core interactions', () => {
  it('Login renders the "Welcome back" sign-in card with all expected fields', () => {
    renderWithProviders(<Login />);
    expect(screen.getByText('Welcome back')).toBeTruthy();
    expect(screen.getByText('Sign in to your account')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your username or email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your password')).toBeTruthy();
    expect(screen.getByText('Remember me')).toBeTruthy();
    expect(screen.getByText('Forgot password?')).toBeTruthy();
    expect(screen.getByText('Sign In')).toBeTruthy();
    expect(document.querySelectorAll('.auth-social-btn').length).toBe(0);
    expect(screen.getByText('Create an account')).toBeTruthy();
  });

  it('Login: password field toggles visibility via the eye button', () => {
    renderWithProviders(<Login />);
    const passwordInput = screen.getByPlaceholderText('Enter your password');
    expect(passwordInput.type).toBe('password');
    const eyeBtn = document.querySelector('.auth-eye-btn');
    act(() => { fireEvent.click(eyeBtn); });
    expect(passwordInput.type).toBe('text');
  });

  it('Login: clicking "Forgot password?" swaps in the Forgot-password card in place', () => {
    renderWithProviders(<Login />);
    act(() => { fireEvent.click(screen.getByText('Forgot password?')); });
    expect(screen.getByText('Forgot your password?')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your email or username')).toBeTruthy();
    expect(screen.getByText('Security first')).toBeTruthy();
    expect(document.querySelector('.auth-back-link')).not.toBeNull();
    // no more separate modal-backdrop popup — it's an in-place card swap now
    expect(document.querySelector('.modal-backdrop')).toBeNull();
  });

  it('Login: "Back to sign in" from the forgot-password card returns to Welcome back', () => {
    renderWithProviders(<Login />);
    act(() => { fireEvent.click(screen.getByText('Forgot password?')); });
    expect(screen.getByText('Forgot your password?')).toBeTruthy();
    act(() => { fireEvent.click(document.querySelector('.auth-back-link')); });
    expect(screen.getByText('Welcome back')).toBeTruthy();
  });

  it('Login: social auth block has been removed entirely (per explicit request)', () => {
    renderWithProviders(<Login />);
    expect(document.querySelector('.auth-social-block')).toBeNull();
    expect(document.querySelector('.auth-divider')).toBeNull();
    expect(screen.queryByText(/continue with/i)).toBeNull();
  });

  it('sidebar-promo / marketplace shell is not present on the auth page (hideShell)', () => {
    renderWithProviders(<Login />);
    expect(document.querySelector('.sidebar')).toBeNull();
    expect(document.querySelector('.app-header')).toBeNull();
  });

  it('Register renders the "Create your account" card with all fields', () => {
    renderWithProviders(<Register />, ['/register']);
    expect(screen.getByText('Create your account')).toBeTruthy();
    expect(screen.getByPlaceholderText('Choose a username')).toBeTruthy();
    expect(screen.getByPlaceholderText('First name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Last name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your email')).toBeTruthy();
    expect(screen.getByPlaceholderText('Create a password')).toBeTruthy();
    expect(screen.getByText('marketplace policy')).toBeTruthy();
    expect(screen.getByText('Sign in')).toBeTruthy();
  });

  it('Register: submitting without agreeing to the policy shows an error, not a silent no-op', () => {
    renderWithProviders(<Register />, ['/register']);
    fireEvent.change(screen.getByPlaceholderText('Choose a username'), { target: { value: 'tester' } });
    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'User' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'tester@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Create a password'), { target: { value: 'Sup3r!Secret' } });
    act(() => { fireEvent.click(screen.getByText('Create account')); });
    expect(screen.getByText('You must accept the policy before registering.')).toBeTruthy();
  });

  it('Register: opening the policy modal still works after the redesign', () => {
    renderWithProviders(<Register />, ['/register']);
    act(() => { fireEvent.click(screen.getByText('marketplace policy')); });
    expect(document.querySelector('.modal-backdrop')).not.toBeNull();
    expect(screen.getByText('Policy')).toBeTruthy();
  });

  it('Register: email field is required and marked with a helper note about 1 account per email', () => {
    renderWithProviders(<Register />, ['/register']);
    const emailInput = screen.getByPlaceholderText('Enter your email');
    expect(emailInput.required).toBe(true);
    expect(screen.getByText(/one account per email address/i)).toBeTruthy();
  });

  it('Register: successful submission with requiresEmailVerification shows the verify-code card, not the home redirect', async () => {
    const { AuthProvider } = await import('../context/AuthContext');
    const axios = (await import('../api/axios')).default;
    const postSpy = jest.spyOn(axios, 'post').mockResolvedValue({
      data: { success: true, requiresEmailVerification: true, email: 'newuser@example.com', verificationSent: true }
    });

    render(
      <MemoryRouter initialEntries={['/register']}>
        <AuthProvider><Register /></AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Choose a username'), { target: { value: 'newuser' } });
    fireEvent.change(screen.getByPlaceholderText('First name'), { target: { value: 'New' } });
    fireEvent.change(screen.getByPlaceholderText('Last name'), { target: { value: 'User' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your email'), { target: { value: 'newuser@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('Create a password'), { target: { value: 'Sup3r!Secret' } });
    fireEvent.click(screen.getByRole('checkbox'));
    await act(async () => { fireEvent.click(screen.getByText('Create account')); });

    expect(screen.getByText('Verify your email')).toBeTruthy();
    expect(screen.getByText(/newuser@example.com/)).toBeTruthy();
    postSpy.mockRestore();
  });

  it('Login: an unverified-account error from the backend shows the verify-code card instead of a generic error', async () => {
    const { AuthProvider } = await import('../context/AuthContext');
    const axios = (await import('../api/axios')).default;
    const postSpy = jest.spyOn(axios, 'post').mockRejectedValue({
      response: { data: { success: false, error: 'Please verify your email before logging in.', requiresEmailVerification: true, email: 'unverified@example.com' } }
    });

    render(
      <MemoryRouter initialEntries={['/login']}>
        <AuthProvider><Login /></AuthProvider>
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText('Enter your username or email'), { target: { value: 'unverified' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your password'), { target: { value: 'whatever' } });
    await act(async () => { fireEvent.click(screen.getByText('Sign In')); });

    expect(screen.getByText('Verify your email')).toBeTruthy();
    expect(screen.getByText(/unverified@example.com/)).toBeTruthy();
    postSpy.mockRestore();
  });

  it('ResetPassword renders the code + new-password card', () => {
    renderWithProviders(<ResetPassword />, ['/reset-password']);
    expect(screen.getByText('Reset your password')).toBeTruthy();
    expect(screen.getByPlaceholderText('000000')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter your new password')).toBeTruthy();
    expect(screen.getByPlaceholderText('Re-enter your new password')).toBeTruthy();
    expect(document.querySelector('.auth-back-link')).not.toBeNull();
  });

  it('ResetPassword: rejects a non-6-digit code with an inline error', () => {
    renderWithProviders(<ResetPassword />, ['/reset-password']);
    fireEvent.change(screen.getByPlaceholderText('000000'), { target: { value: '123' } });
    fireEvent.change(screen.getByPlaceholderText('Enter your new password'), { target: { value: 'Sup3r!Secret' } });
    fireEvent.change(screen.getByPlaceholderText('Re-enter your new password'), { target: { value: 'Sup3r!Secret' } });
    act(() => { fireEvent.click(screen.getByText('Reset password')); });
    expect(screen.getByText('Reset code must be a 6-digit token.')).toBeTruthy();
  });
});
