/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6f5",
          100: "#d7e9e6",
          200: "#b0d3cd",
          300: "#82b8af",
          400: "#559a8f",
          500: "#377f73",
          600: "#2a655c",
          700: "#24514a",
          800: "#20423d",
          900: "#1c3733",
        },
        brass: {
          50: "#faf5e9",
          100: "#f1e3c1",
          200: "#e3c785",
          300: "#d4ab52",
          400: "#c99a3d",
          500: "#b3872f",
          600: "#8f6b25",
        },
        paper: "#fbf9f1",
        ink: "#1c201f",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        serif: ["var(--font-display)", "Georgia", "serif"],
      },
    },
  },
};
