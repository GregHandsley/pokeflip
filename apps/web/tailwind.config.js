/** @type {import('tailwindcss').Config} */
export default {
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
    theme: {
      extend: {
        // optional typography/radius defaults
        borderRadius: {
          lg: "0.5rem",
          xl: "0.75rem",
          "2xl": "1rem",
        },
        boxShadow: {
          card: "0 1px 2px 0 rgba(0,0,0,0.04)",
        },
      },
    },
    plugins: [],
  }