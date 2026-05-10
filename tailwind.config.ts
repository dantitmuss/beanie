import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#FAFAFA',
        surface: '#FFFFFF',
        border: '#E4E4E7',
        primary: '#0A0A0A',
        secondary: '#71717A',
        accent: '#6366F1',
        'suit-red': '#DC2626',
        'suit-black': '#0A0A0A',
        'valid-green': '#16A34A',
        'error-red': '#DC2626',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        card: '8px',
      },
    },
  },
  plugins: [],
} satisfies Config;
