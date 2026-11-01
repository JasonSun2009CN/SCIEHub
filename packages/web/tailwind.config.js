/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: 'rgb(var(--background-rgb) / <alpha-value>)',
        foreground: 'rgb(var(--foreground-rgb) / <alpha-value>)',
        surface: 'rgb(var(--surface-rgb) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2-rgb) / <alpha-value>)',
        border: 'rgb(var(--border-rgb) / <alpha-value>)',
        input: 'rgb(var(--input-rgb) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--muted-rgb) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground-rgb) / <alpha-value>)',
        },
        accent: { DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)', foreground: 'var(--accent-foreground)' },
        'accent-subtle': 'var(--accent-subtle)',
        primary: { DEFAULT: 'rgb(var(--primary-rgb) / <alpha-value>)', foreground: 'var(--primary-foreground)' },
        success: { DEFAULT: 'rgb(var(--success-rgb) / <alpha-value>)', subtle: 'var(--success-subtle)' },
        error: { DEFAULT: 'rgb(var(--error-rgb) / <alpha-value>)', subtle: 'var(--error-subtle)' },
        warning: { DEFAULT: 'rgb(var(--warning-rgb) / <alpha-value>)', subtle: 'var(--warning-subtle)' },
        ring: 'var(--ring)',
        popover: { DEFAULT: 'rgb(var(--popover-rgb) / <alpha-value>)', foreground: 'var(--popover-foreground)' },
        card: { DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)', foreground: 'var(--foreground)' },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 3px)',
        sm: 'calc(var(--radius) - 5px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 10px)',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'Times New Roman', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        soft: '0 1px 2px rgb(0 0 0 / 0.04), 0 18px 40px -30px rgb(0 0 0 / 0.35)',
        lift: '0 28px 60px -35px rgb(0 0 0 / 0.55)',
        glow: '0 0 0 1px rgb(94 234 212 / 0.18), 0 12px 40px -18px rgb(94 234 212 / 0.28)',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
