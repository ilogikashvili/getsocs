import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'gs_theme';
const DARK = 'dark';
const LIGHT = 'light';

const ThemeContext = createContext({
  theme: DARK,
  isDark: true,
  setTheme: () => {},
  toggleTheme: () => {}
});

function readInitialTheme() {
  if (typeof window === 'undefined') return DARK;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === LIGHT ? LIGHT : DARK;
  } catch (error) {
    return DARK;
  }
}

function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;

  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === LIGHT ? '#f7f8ff' : '#07081f');
  }
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readInitialTheme);

  useLayoutEffect(() => {
    applyTheme(theme);
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch (error) {
      // The theme still works for this tab if storage is unavailable.
    }
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    setThemeState(nextTheme === LIGHT ? LIGHT : DARK);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState(current => current === DARK ? LIGHT : DARK);
  }, []);

  const value = useMemo(() => ({
    theme,
    isDark: theme === DARK,
    setTheme,
    toggleTheme
  }), [theme, setTheme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

export { DARK as DARK_THEME, LIGHT as LIGHT_THEME, STORAGE_KEY as THEME_STORAGE_KEY };
export default ThemeContext;
