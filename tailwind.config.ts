import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#faf8f7',
          100: '#f5f0ef',
          200: '#ebe3df',
          300: '#dcccc3',
          400: '#c8aea3',
          500: '#b89083',
          DEFAULT: '#b89083',
          600: '#a0785c',
          700: '#88664e',
          800: '#6f5541',
          900: '#5a4538',
        },
        accent: {
          50: '#fef9f3',
          100: '#fef3e8',
          200: '#fce4cb',
          300: '#fad5ae',
          400: '#f5b872',
          500: '#f09a36',
          DEFAULT: '#f09a36',
          600: '#d97e1f',
          700: '#b8611a',
          800: '#964d18',
          900: '#7a3e17',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
    },
  },
  plugins: [],
}

export default config
