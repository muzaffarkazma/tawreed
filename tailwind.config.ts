import type { Config } from 'tailwindcss';

// Colours come from CSS variables (see globals.css) so light and dark themes match the Tawreed prototype.
const v = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: v('brand'), ink: v('brand-ink'), soft: v('brand-soft'), dark: '#0E3B2A' },
        surface: v('surface'), ink: v('ink'), muted: v('muted'), line: v('line'), line2: v('line2'), sunk: v('sunk'), canvas: v('bg'),
        ok: { DEFAULT: v('ok'), soft: v('ok-soft') }, warn: { DEFAULT: v('warn'), soft: v('warn-soft') },
        bad: { DEFAULT: v('bad'), soft: v('bad-soft') }, info: { DEFAULT: v('info'), soft: v('info-soft') },
        ai: { DEFAULT: v('ai'), soft: v('ai-soft'), line: v('ai-line') },
        gold: v('warn')
      },
      fontFamily: { sans: ['"IBM Plex Sans Arabic"', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'] }
    }
  },
  plugins: []
} satisfies Config;
