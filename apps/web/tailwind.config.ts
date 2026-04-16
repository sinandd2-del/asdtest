import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      padding: {
        safe: 'max(env(safe-area-inset-bottom), 1rem)'
      }
    }
  },
  plugins: []
} satisfies Config;
