import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        sbb: {
          yellow: "#FFC107",
          black: "#000000",
          dark: "#151515",
          light: "#F6F2EB",
          grey: "#777777",
        },
      },
      borderRadius: {
        card: "28px",
        pill: "999px",
      },
      boxShadow: {
        card: "0 18px 50px rgba(0,0,0,.12)",
        premium: "0 30px 70px rgba(0,0,0,.18)",
      },
      fontFamily: {
        body: ["Poppins", "system-ui", "sans-serif"],
        hero: ["Anton", "Montserrat", "Poppins", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
