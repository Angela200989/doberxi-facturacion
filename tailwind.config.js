/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        doberxi: {
          dark: '#1E293B',
          gold: '#C9A86A',
          teal: '#0F766E',
        }
      }
    },
  },
  plugins: [],
}
