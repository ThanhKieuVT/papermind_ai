import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // Muted sage — the primary "natural" brand colour (low saturation on purpose).
        brand: {
          50: "#f4f5f0",
          100: "#e6e9de",
          200: "#cfd5c0",
          300: "#b0b99a",
          400: "#8f9a76",
          500: "#737f5b",
          600: "#5c6748",
          700: "#4a533b",
          800: "#3d4432",
          900: "#33392b",
          950: "#1b1f16",
        },
        // Oatmeal paper background.
        cream: {
          50: "#faf9f6",
          100: "#f3f1eb",
          200: "#e7e3d8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
