/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cream: '#FDFCF7',
        charcoal: '#1A1A1A',
        'emerald-muted': '#4B7C68',
        primary: '#11d4b4',
        'beige-soft': '#fdfaf3',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Manrope', 'sans-serif'],
      },
      keyframes: {
        'pulse-gentle': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
      },
      animation: {
        'pulse-gentle': 'pulse-gentle 3s infinite ease-in-out',
      },
    },
  },
  plugins: [],
};
