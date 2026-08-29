import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Heebo", "Assistant", "Rubik", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#1c1917",
        paper: "#fdfcfb",
        blush: {
          50: "#fdf2f4",
          100: "#fce7ea",
          200: "#f9d0d8",
          400: "#e8879b",
          500: "#d9536f",
          600: "#c23a58",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
