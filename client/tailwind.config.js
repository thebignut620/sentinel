/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
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
          700: '#4aaa4a',
          800: '#3d8c3d',
          900: '#2d6a2d',
          950: '#1a3d1a',
        },
      },
    },
  },
  plugins: [],
};
