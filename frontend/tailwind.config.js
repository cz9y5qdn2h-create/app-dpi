/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary':     '#080808',
        'bg-card':        '#141414',
        'bg-elevated':    '#1A1A1A',
        'text-primary':   '#F4F2EE',
        'text-secondary': '#5A5A5A',
        'text-muted':     '#3A3A3A',
        'gold':           '#C8A96E',
        'gold-light':     '#D4BC8A',
        'gold-dim':       'rgba(200,169,110,0.18)',
        'border-subtle':  'rgba(200,169,110,0.18)',
        'border-default': 'rgba(200,169,110,0.25)',
        'success':        '#22c55e',
        'warning':        '#C8A96E',
        'danger':         '#ef4444',
      },
      fontFamily: {
        'cormorant': ['Cormorant Garamond', 'Georgia', 'serif'],
        'dm-sans':   ['DM Sans', 'sans-serif'],
        'dm-mono':   ['DM Mono', 'monospace'],
      },
      fontSize: {
        'display': ['3.5rem', { lineHeight: '1.1', fontWeight: '300' }],
        'h1':      ['2.25rem', { lineHeight: '1.2', fontWeight: '300' }],
        'h2':      ['1.75rem', { lineHeight: '1.3', fontWeight: '300' }],
        'h3':      ['1.25rem', { lineHeight: '1.4', fontWeight: '400' }],
      },
      animation: {
        'fade-in':    'fadeIn 0.4s ease forwards',
        'slide-up':   'slideUp 0.3s ease forwards',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite',
        'skeleton':   'skeleton 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp:   { from: { opacity: '0', transform: 'translateY(10px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        pulseGold: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
        skeleton:  { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.4' } },
      },
    },
  },
  plugins: [],
};
