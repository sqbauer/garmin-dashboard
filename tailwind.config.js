/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Biological, recovery-oriented palette — muted, never neon
        pine: {
          950: '#091710',
          900: '#0d1f17',
          800: '#1a3329',
          700: '#27493d',
          600: '#345e4f',
          500: '#3d6b55',  // main: "recovered / optimal"
          400: '#5a9470',
          300: '#7abf95',
          200: '#a8d9bc',
          100: '#d4eedf',
        },
        amber: {
          950: '#150d00',
          900: '#1f1400',
          800: '#2e2004',
          700: '#4a360a',
          600: '#6b4d0f',
          500: '#8b6914',  // main: "elevated stress / taper"
          400: '#b08a28',
          300: '#c4961a',
          200: '#e0bc6a',
          100: '#f5e5b8',
        },
        slate: {
          950: '#080e18',
          900: '#0d1520',
          800: '#131e2e',
          700: '#1a2840',
          600: '#243654',
          500: '#3b5270',  // main: "neutral baseline"
          400: '#4e6b8f',
          300: '#6a8fba',
          200: '#95b5d8',
          100: '#c4d8ef',
        },
        // Neutral ink scale (backgrounds, text, borders)
        ink: {
          950: '#06080e',
          900: '#0c0f17',  // page background
          850: '#0f1320',  // surface 0
          800: '#131822',  // surface 1
          750: '#171e2a',  // surface 2 (cards)
          700: '#1c2432',  // surface 3
          600: '#242f40',  // border heavy
          500: '#2e3d52',  // border
          400: '#3e5068',  // border light
          300: '#56697e',  // muted text
          200: '#7a90a5',  // secondary text
          100: '#b0c0cf',  // primary text
          50:  '#dde8f0',  // heading text
        },
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'Menlo', 'monospace'],
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.05em' }],
        xs:   ['11px', { lineHeight: '16px' }],
        sm:   ['12px', { lineHeight: '18px' }],
        base: ['13px', { lineHeight: '20px' }],
        md:   ['14px', { lineHeight: '22px' }],
        lg:   ['15px', { lineHeight: '24px' }],
        xl:   ['17px', { lineHeight: '26px' }],
        '2xl':['20px', { lineHeight: '28px' }],
        '3xl':['24px', { lineHeight: '32px' }],
        '4xl':['30px', { lineHeight: '36px' }],
        '5xl':['38px', { lineHeight: '44px', letterSpacing: '-0.02em' }],
      },
      borderRadius: {
        '4xl': '1.5rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.22,1,0.36,1)',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { transform: 'translateY(8px)', opacity: 0 }, to: { transform: 'translateY(0)', opacity: 1 } },
      },
    },
  },
  plugins: [],
}
