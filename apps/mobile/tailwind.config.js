/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#2D9B6F',
        'primary-dark': '#1A6B4A',
        'primary-light': '#F0F9F4',
        'primary-lighter': '#56C794',
      },
    },
  },
  plugins: [],
}
