/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        heading: ['"Titillium Web"', 'sans-serif'],
      },
      colors: {
        pine: {
          50:  '#edf7ed',
          100: '#d4ecd4',
          200: '#a8d6a8',
          300: '#74bb74',
          400: '#5dc55d',
          500: '#4aaa4a',
          600: '#3d8c3d',
          700: '#347534',
          800: '#2d6a2d',
          900: '#1f4d1f',
          950: '#132f13',
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideOutRight: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-8px)' },
          '30%': { transform: 'translateX(8px)' },
          '45%': { transform: 'translateX(-6px)' },
          '60%': { transform: 'translateX(6px)' },
          '75%': { transform: 'translateX(-3px)' },
          '90%': { transform: 'translateX(3px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 8px rgba(74,170,74,0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(74,170,74,0.6)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 0.5s ease-out forwards',
        slideInRight: 'slideInRight 0.35s ease-out forwards',
        slideOutRight: 'slideOutRight 0.3s ease-in forwards',
        shake: 'shake 0.5s ease-in-out',
        shimmer: 'shimmer 1.8s infinite linear',
        glowPulse: 'glowPulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
