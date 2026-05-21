/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f5f7ff",
          100: "#e8edff",
          500: "#5b6cff",
          600: "#4754e6",
          700: "#3641c2",
        },
      },
    },
  },
  plugins: [],
};
