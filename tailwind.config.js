/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,jsx,ts,tsx}",
    "!./node_modules/**",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}