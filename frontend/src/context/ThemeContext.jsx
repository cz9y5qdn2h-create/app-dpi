import { createContext, useContext, useEffect, useState } from 'react';

export const THEMES = [
  { id: 'glass',    label: 'Iralink Glass',  desc: 'Clair · Glassmorphisme', bg: '#dde2f5', accent: '#c8a96e' },
  { id: 'nuit',     label: 'Nuit Dorée',     desc: 'Sombre · Or',            bg: '#141414', accent: '#c8a96e' },
  { id: 'azur',     label: 'Azur',           desc: 'Marine · Glacé',         bg: '#0a1628', accent: '#60a5fa' },
  { id: 'nacre',    label: 'Nacre',          desc: 'Blanc · Épuré',          bg: '#f8f8fa', accent: '#b8962a' },
  { id: 'emeraude', label: 'Émeraude',       desc: 'Forêt · Sombre',         bg: '#0c180d', accent: '#4ade80' },
];

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans ThemeProvider');
  return ctx;
}

export default function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('dippro-theme') || 'glass'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('dippro-theme', theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeState, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}
