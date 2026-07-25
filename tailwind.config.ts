import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: "var(--ivory)",
        white: "var(--white)",
        hairline: "var(--hairline)",
        track: "var(--track)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        green: "var(--green)",
        "green-soft": "var(--green-soft)",
        amber: "var(--amber)",
        "amber-soft": "var(--amber-soft)",
        "amber-ink": "var(--amber-ink)",
        danger: "var(--danger)",
        background: "rgb(var(--color-background) / <alpha-value>)",
        section: "rgb(var(--color-section) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        card: "rgb(var(--color-card) / <alpha-value>)",
        "ink-soft": "rgb(var(--color-ink-soft) / <alpha-value>)",
        body: "rgb(var(--color-body) / <alpha-value>)",
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
        card: "1.25rem",
        option: "1rem",
        field: "0.875rem",
        expressive: "1.25rem",
        productive: "0.875rem",
      },
      boxShadow: {
        soft: "0 18px 44px -28px rgba(52, 89, 74, 0.28)",
      },
      transitionTimingFunction: {
        // Deliberate entrance/state-change curve, not a blanket ease-out
        // replacement. Applied selectively; see app/globals.css --ease-out.
        expressive: "var(--ease-out)",
      },
    },
  },
  plugins: [
    // Mobile-first PWA, primarily iOS Safari: bare `:hover` triggers on tap
    // and can leave elements looking stuck until the next tap elsewhere.
    // Scope hover (and its group/peer variants) to pointer-fine devices.
    plugin(({ addVariant }) => {
      const pointerFineHover = "@media (hover: hover) and (pointer: fine)";
      addVariant("hover", `${pointerFineHover} { &:hover }`);
      addVariant("group-hover", `${pointerFineHover} { :merge(.group):hover & }`);
      addVariant("peer-hover", `${pointerFineHover} { :merge(.peer):hover ~ & }`);
    }),
  ],
};
export default config;
