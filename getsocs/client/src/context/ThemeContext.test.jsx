import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from './ThemeContext';

function ThemeProbe() {
  const { theme, toggleTheme } = useTheme();
  return <button type="button" onClick={toggleTheme}>Theme: {theme}</button>;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = 'dark';
  });

  test('keeps dark mode as the default', () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    expect(screen.getByRole('button')).toHaveTextContent('Theme: dark');
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
  });

  test('switches to light mode and persists the preference', async () => {
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);
    await userEvent.click(screen.getByRole('button'));

    expect(screen.getByRole('button')).toHaveTextContent('Theme: light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
    expect(window.localStorage.getItem('gs_theme')).toBe('light');
  });

  test('restores a saved light preference', () => {
    window.localStorage.setItem('gs_theme', 'light');
    render(<ThemeProvider><ThemeProbe /></ThemeProvider>);

    expect(screen.getByRole('button')).toHaveTextContent('Theme: light');
    expect(document.documentElement).toHaveAttribute('data-theme', 'light');
  });
});
