/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          300: '#5DD985',
          400: '#34C759',
          500: '#2CB34F',
          600: '#259B45',
          700: '#1E8A3C',
        },
        ios: {
          bg: '#000000',
          surface: '#1C1C1E',
          surface2: '#2C2C2E',
          gray: '#8E8E93',
          gray2: '#6E6E73',
          blue: '#007AFF',
          orange: '#FF9500',
          red: '#FF3B30',
          indigo: '#5856D6',
          teal: '#5AC8FA',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'SF Pro Text',
          'SF Pro Display',
          'Segoe UI',
          'Roboto',
          'Helvetica',
          'Arial',
          'sans-serif',
        ],
      },
    },
  },
  plugins: [],
};
