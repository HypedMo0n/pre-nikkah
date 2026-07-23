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
        // v3 token set, referenced via CSS var() rather than the old
        // rgb-triplet trick. Tailwind 3.4+ generates opacity modifiers
        // (e.g. bg-ink/30) for var()-based colors automatically via
        // color-mix(), so that still works; the design system's own -soft
        // variants are preferred over ad hoc opacity for anything that
        // isn't a temporary overlay. See app/globals.css for the values.
        ivory: "var(--ivory)",
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
      },
      borderRadius: {
        card: "var(--radius-card)",
        option: "var(--radius-option)",
        input: "var(--radius-input)",
      },
      boxShadow: {
        soft: "0 18px 44px -28px rgba(35, 32, 28, 0.42)",
      },
      transitionTimingFunction: {
        // Distinctly named rather than overriding Tailwind's built-in
        // ease-out/ease-in-out utility classes — these three curves are
        // applied selectively (see §9), not as a blanket easing swap.
        "app-out": "var(--ease-out)",
        "app-in-out": "var(--ease-in-out)",
        "app-drawer": "var(--ease-drawer)",
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
