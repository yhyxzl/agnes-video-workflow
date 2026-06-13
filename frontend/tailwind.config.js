/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#FAECE7",
          100: "#F5C4B3",
          200: "#F0997B",
          400: "#D85A30",
          500: "#993C1D",
          600: "#712B13",
          700: "#4A1B0C",
        },
        dark: {
          50: "#F8F6F3",
          100: "#F1EFE8",
          150: "#EBE8E0",
          200: "#E8E4DD",
          300: "#D3D1C7",
          400: "#B4B2A9",
          500: "#888780",
          600: "#5F5E5A",
          700: "#444441",
          800: "#2C2C2A",
          900: "#1A1A18",
        },
        node: {
          prompt: { light: "#EEEDFE", DEFAULT: "#7F77DD", dark: "#3C3489" },
          image: { light: "#E6F1FB", DEFAULT: "#378ADD", dark: "#185FA5" },
          video: { light: "#FAEEDA", DEFAULT: "#BA7517", dark: "#854F0B" },
          video2: { light: "#FBEAF0", DEFAULT: "#D4537E", dark: "#993556" },
          output: { light: "#EAF3DE", DEFAULT: "#639922", dark: "#3B6D11" },
        },
      },
    },
  },
  plugins: [],
}
