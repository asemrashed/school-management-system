/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require("@packages/ui/tailwind-preset.js")],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
