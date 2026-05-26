'use client';

import { createContext, useContext, useEffect, useState } from 'react';

// ── Color tokens ──────────────────────────────────────────────────────────────

export const COLORS = {
  light: {
    // Backgrounds
    bg:           '#f5f0e8',
    bgGradient:   'linear-gradient(160deg, #f9f5ee 0%, #f3ede3 60%, #ede5d8 100%)',
    sidebar:      '#ffffff',
    card:         '#ffffff',
    cardHover:    '#fdfaf5',
    input:        'rgba(255,255,255,0.85)',
    inputHover:   '#ffffff',
    muted:        'rgba(249,245,238,0.85)',
    // Borders
    cardBorder:   '1.5px solid rgba(200,169,110,0.18)',
    divider:      'rgba(200,169,110,0.12)',
    sidebarBorder:'rgba(200,169,110,0.2)',
    sidebarShadow:'2px 0 20px rgba(26,24,20,0.04)',
    inputBorder:  'rgba(200,169,110,0.25)',
    inputFocus:   '#c8a96e',
    // Text
    text1:        '#1a1814',
    text2:        '#7a7468',
    text3:        '#b8a898',
    text4:        '#4a4540',
    // Buttons
    btnActive:    '#1a1814',
    btnActiveTxt: '#f5f0e8',
    btnInactive:  'rgba(249,245,238,0.8)',
    btnInactiveTxt:'#7a7468',
    btnInactiveBorder:'rgba(200,169,110,0.25)',
    // Misc
    filterPill:   'rgba(249,245,238,0.8)',
    filterBorder: 'rgba(200,169,110,0.25)',
    filterActive: '#1a1814',
    filterActiveTxt: '#f5f0e8',
  },
  dark: {
    // Backgrounds
    bg:           '#0f0e0b',
    bgGradient:   'linear-gradient(160deg, #161310 0%, #130f0c 60%, #0f0d0a 100%)',
    sidebar:      '#141210',
    card:         '#1c1916',
    cardHover:    '#211e1a',
    input:        'rgba(28,25,22,0.9)',
    inputHover:   'rgba(33,30,26,0.95)',
    muted:        'rgba(28,25,22,0.8)',
    // Borders
    cardBorder:   '1.5px solid rgba(200,169,110,0.12)',
    divider:      'rgba(200,169,110,0.08)',
    sidebarBorder:'rgba(200,169,110,0.15)',
    sidebarShadow:'2px 0 24px rgba(0,0,0,0.35)',
    inputBorder:  'rgba(200,169,110,0.18)',
    inputFocus:   '#c8a96e',
    // Text
    text1:        '#ede5d5',
    text2:        '#7a7468',
    text3:        '#4a4540',
    text4:        '#9a9088',
    // Buttons
    btnActive:    '#f0e8d8',
    btnActiveTxt: '#1a1814',
    btnInactive:  'rgba(28,25,22,0.85)',
    btnInactiveTxt:'#6e6660',
    btnInactiveBorder:'rgba(200,169,110,0.18)',
    // Misc
    filterPill:   'rgba(28,25,22,0.85)',
    filterBorder: 'rgba(200,169,110,0.18)',
    filterActive: '#f0e8d8',
    filterActiveTxt: '#1a1814',
  },
} as const;

export type Theme  = 'light' | 'dark';
export type Colors = typeof COLORS['light'];

// ── Context ───────────────────────────────────────────────────────────────────

interface ThemeCtx {
  theme:  Theme;
  isDark: boolean;
  toggle: () => void;
  c:      Colors;
}

const Ctx = createContext<ThemeCtx>({
  theme:  'light',
  isDark: false,
  toggle: () => {},
  c:      COLORS.light,
});

// ── Provider ──────────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    const saved   = localStorage.getItem('inmobia-theme') as Theme | null;
    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const initial = saved ?? (sysDark ? 'dark' : 'light');
    applyTheme(initial);
    setTheme(initial);
  }, []);

  function applyTheme(t: Theme) {
    document.documentElement.setAttribute('data-theme', t);
  }

  function toggle() {
    setTheme(prev => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem('inmobia-theme', next);
      applyTheme(next);
      return next;
    });
  }

  return (
    <Ctx.Provider value={{ theme, isDark: theme === 'dark', toggle, c: COLORS[theme] }}>
      {children}
    </Ctx.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTheme() {
  return useContext(Ctx);
}
