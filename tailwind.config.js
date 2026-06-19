/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    fontSize: {
      'xs':   ['0.7rem',   { lineHeight: '1rem' }],
      'sm':   ['0.8rem',   { lineHeight: '1.2rem' }],
      'base': ['0.875rem', { lineHeight: '1.4rem' }],
      'lg':   ['0.95rem',  { lineHeight: '1.5rem' }],
      'xl':   ['1.05rem',  { lineHeight: '1.6rem' }],
      '2xl':  ['1.2rem',   { lineHeight: '1.75rem' }],
      '3xl':  ['1.4rem',   { lineHeight: '2rem' }],
      '4xl':  ['1.6rem',   { lineHeight: '2.25rem' }],
      '5xl':  ['1.875rem', { lineHeight: '1' }],
    },
    extend: {
      colors: {
        primary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        secondary: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899',
          600: '#db2777',
          700: '#be185d',
          800: '#9f1239',
          900: '#831843',
        }
      },
      boxShadow: {
        '3xl': '0 35px 60px -12px rgba(0, 0, 0, 0.25)',
        'glow': '0 0 20px rgba(234, 179, 8, 0.3)',
        'glow-lg': '0 0 30px rgba(234, 179, 8, 0.5)',
      },
      animation: {
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s infinite',
        'glow': 'glow 2s ease-in-out infinite',
      },
      backdropBlur: {
        'xs': '2px',
      }
    },
  },
  plugins: [],
};
