import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        gold: '#DBA935',
        darkwhite: '#3E3B3F',
        silver: '#c0c0c0',
      },
      fontFamily: {
        sans: ['var(--font-cairo)', 'sans-serif'],
        alata: ['var(--font-alata)', 'Alata', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config