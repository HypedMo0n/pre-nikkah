import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--color-background) / <alpha-value>)",
        section: "rgb(var(--color-section) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        card: "rgb(var(--color-card) / <alpha-value>)",
        "ink-soft": "rgb(var(--color-ink-soft) / <alpha-value>)",
        body: "rgb(var(--color-body) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        primary: "rgb(var(--color-primary) / <alpha-value>)",
        "primary-soft": "rgb(var(--color-primary-soft) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        aligned: "rgb(var(--color-aligned) / <alpha-value>)",
        "aligned-soft": "rgb(var(--color-aligned-soft) / <alpha-value>)",
        discuss: "rgb(var(--color-discuss) / <alpha-value>)",
        "discuss-soft": "rgb(var(--color-discuss-soft) / <alpha-value>)",
        concern: "rgb(var(--color-concern) / <alpha-value>)",
        "concern-soft": "rgb(var(--color-concern-soft) / <alpha-value>)",
      },
      borderRadius: {
        expressive: "1.125rem",
        productive: "0.75rem",
      },
      boxShadow: {
        soft: "0 18px 44px -28px rgba(23, 35, 66, 0.42)",
      },
    },
  },
  plugins: [],
};
export default config;
