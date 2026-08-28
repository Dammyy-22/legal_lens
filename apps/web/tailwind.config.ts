import type { Config } from 'tailwindcss'

// Design tokens for LegalLens. Grounded in the subject — legal documents, statute
// ledgers, gazette paper — not generic SaaS blue. See DECISIONS.md for the design
// rationale.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#14261E', // deep statute-ledger green, primary brand color
          50: '#EEF2F0',
          100: '#D5DFDA',
          400: '#3C5A4C',
          600: '#1F4D3D',
          900: '#14261E',
        },
        paper: {
          DEFAULT: '#F5F1E7', // warm gazette paper — not the AI-cliché #F4F1EA
          50: '#FFFFFF',
          100: '#F5F1E7',
          200: '#EAE3D1',
        },
        brass: {
          DEFAULT: '#B08D3E', // gilt-edge accent, used sparingly
          400: '#C7A968',
          600: '#8F701F',
        },
        seal: {
          DEFAULT: '#8C3B2E', // muted sealing-wax red, for alerts/emphasis only
        },
        charcoal: '#1C1C1A',
      },
      fontFamily: {
        display: ['Newsreader', 'Georgia', 'serif'],
        body: ['"Public Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      backgroundImage: {
        'paper-grain': "radial-gradient(circle at 1px 1px, rgba(20,38,30,0.045) 1px, transparent 0)",
      },
      backgroundSize: {
        grain: '18px 18px',
      },
      keyframes: {
        'ink-in': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'stamp': {
          '0%': { opacity: '0', transform: 'scale(1.3) rotate(-6deg)' },
          '60%': { opacity: '1', transform: 'scale(0.96) rotate(-6deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(-6deg)' },
        },
      },
      animation: {
        'ink-in': 'ink-in 0.6s ease-out both',
        'stamp': 'stamp 0.45s cubic-bezier(0.2,0.8,0.3,1) both',
      },
    },
  },
  plugins: [],
}
export default config
