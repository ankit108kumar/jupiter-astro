// ── Tailwind v4 dark mode ──────────────────────────────────────────
// In Tailwind v4, you no longer use tailwind.config.ts for darkMode.
// Instead, add this ONE line to your global CSS file (globals.css):
//
//   @variant dark (&:where(.dark, .dark *));
//
// This tells Tailwind v4 to activate dark: variants when a .dark class
// exists on a parent element — exactly what the Navbar toggle sets.
//
// ── globals.css example ───────────────────────────────────────────
// @import "tailwindcss";
// @variant dark (&:where(.dark, .dark *));
//
// That's all you need. No tailwind.config.ts changes required for v4.