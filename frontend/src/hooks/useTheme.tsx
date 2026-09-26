import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { ThemeContext } from './themeContext';
import type { Theme } from './themeContext';

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light';
  const stored = localStorage.getItem('commute-theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('commute-theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    // Add transition class briefly for smooth theme switch
    document.documentElement.classList.add('theme-transition');
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    setTimeout(() => {
      document.documentElement.classList.remove('theme-transition');
    }, 350);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
