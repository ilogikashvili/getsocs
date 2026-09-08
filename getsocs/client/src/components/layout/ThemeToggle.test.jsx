import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../../context/ThemeContext';
import ThemeToggle from './ThemeToggle';

describe('ThemeToggle', () => {
  beforeEach(() => window.localStorage.clear());

  test('exposes the next theme through an accessible label', async () => {
    render(<ThemeProvider><ThemeToggle /></ThemeProvider>);

    const lightButton = screen.getByRole('button', { name: /switch to light mode/i });
    await userEvent.click(lightButton);

    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });
});
