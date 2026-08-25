/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,ts,tsx}', './components/**/*.{js,ts,tsx}'],

  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Matches ysc.org's assets/tailwind.config.js exactly (see STYLE_GUIDE.md)
      // so the app reads as the same product as the web admin dashboard —
      // same blue accent, same neutral (zinc-only) scale.
      colors: {
        brand: '#144993',
        primary: '#144993',
        blue: {
          50: '#eef8ff',
          100: '#d8efff',
          200: '#b9e3ff',
          300: '#89d3ff',
          400: '#52bbff',
          500: '#2a9dff',
          600: '#1381fd',
          700: '#0c69e9',
          800: '#1154bc',
          900: '#144993',
          950: '#112d5a',
        },
      },
    },
  },
  plugins: [],
};
