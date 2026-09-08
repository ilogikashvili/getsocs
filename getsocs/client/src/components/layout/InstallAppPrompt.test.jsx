import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import InstallAppPrompt from './InstallAppPrompt';

function setBrowser({ userAgent, width = 390, secure = true }) {
  Object.defineProperty(window.navigator, 'userAgent', { value: userAgent, configurable: true });
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'isSecureContext', { value: secure, configurable: true });
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  }));
}

describe('InstallAppPrompt', () => {
  beforeEach(() => {
    window.localStorage.clear();
    setBrowser({ userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36' });
  });

  test('lets Android users trigger the native install prompt when available', async () => {
    const prompt = jest.fn();
    render(<InstallAppPrompt />);

    const event = new Event('beforeinstallprompt');
    event.prompt = prompt;
    event.userChoice = Promise.resolve({ outcome: 'accepted' });

    await act(async () => {
      window.dispatchEvent(event);
    });

    await act(async () => {
      await userEvent.click(screen.getByRole('button', { name: /^add widget$/i }));
    });
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  test('shows Safari home-screen instructions for iPhone users', async () => {
    setBrowser({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1' });

    render(<InstallAppPrompt />);

    expect(screen.getByText(/iphone needs one safari step/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^add widget$/i }));

    expect(screen.getByRole('dialog', { name: /add getsocs widget/i })).toBeInTheDocument();
    expect(screen.getByText(/apple does not let websites install automatically/i)).toBeInTheDocument();
    expect(screen.getByText(/open getsocs.com in safari/i)).toBeInTheDocument();
    expect(screen.getByText(/^Tap Add\.$/i)).toBeInTheDocument();
  });

  test('keeps insecure mobile browsers on the HTTPS requirement message', () => {
    setBrowser({
      userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
      secure: false
    });

    render(<InstallAppPrompt />);

    expect(screen.getByText(/install needs https/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^add widget$/i })).not.toBeInTheDocument();
  });

  test('persists dismissal', () => {
    render(<InstallAppPrompt />);

    fireEvent.click(screen.getByRole('button', { name: /dismiss install prompt/i }));

    expect(window.localStorage.getItem('gs_install_prompt_dismissed')).toBe('1');
    expect(screen.queryByLabelText(/install getsocs/i)).not.toBeInTheDocument();
  });
});
