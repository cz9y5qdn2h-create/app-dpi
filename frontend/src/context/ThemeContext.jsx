import { createContext, useContext, useEffect, useState } from 'react';

const THEMES = [
  { id: 'clair',  label: 'Clair',  icon: 'sun'  },
  { id: 'sombre', label: 'Sombre', icon: 'moon' },
];

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans ThemeProvider');
  return ctx;
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem('dippro-theme');
    if (saved === 'clair' || saved === 'sombre') return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'sombre' : 'clair';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dippro-theme', theme);
  }, [theme]);

  const toggleTheme = () => setThemeState(t => t === 'clair' ? 'sombre' : 'clair');

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, toggleTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
