import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['DM Serif Display', 'Georgia', 'serif'],
      },
      colors: {
        ink:   '#1a1814',
        cream: {
          DEFAULT: '#f5f0e8',
          light:   '#f9f5ee',
          dark:    '#efe6d8',
        },
        warm: {
          DEFAULT: '#c8a96e',
          light:   '#ede0c8',
          muted:   'rgba(200,169,110,0.18)',
        },
        muted: '#7a7468',
      },
    },
  },
  plugins: [],
};

export default config;
