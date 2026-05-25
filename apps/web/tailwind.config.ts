import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Couleurs primaires VOYO
        navy: {
          50:  '#E8EDF4',
          100: '#C4D0E3',
          200: '#9BB0CE',
          300: '#7290B9',
          400: '#5578AA',
          500: '#3860A2',
          600: '#2A4E8C',
          700: '#1A3A72',
          800: '#0D2859',
          900: '#072B57', // Primary Navy
          950: '#041A3A',
        },
        teal: {
          50:  '#E0F9F7',
          100: '#B3F1EC',
          200: '#7FE8E0',
          300: '#4DDFD4',
          400: '#2DD4C6',
          500: '#16C7B8', // Voyo Teal
          600: '#0FAD9F',
          700: '#098F83',
          800: '#037167',
          900: '#00534C',
        },
        blue: {
          400: '#60A5FA',
          500: '#2D8CFF', // Sky Blue (accent)
          600: '#1D7AEE',
        },
        success: '#34C759',
        warning: '#FF9500',
        danger:  '#FF3B30',
        // UI
        surface: '#F5F7FA', // Background
        'surface-2': '#EAECF0',
        'surface-3': '#FFFFFF',
      },
      fontFamily: {
        poppins: ['Poppins', 'sans-serif'],
        inter:   ['Inter', 'sans-serif'],
      },
      fontSize: {
        'xs':   ['12px', '16px'],
        'sm':   ['13px', '18px'],
        'base': ['14px', '20px'],
        'md':   ['15px', '22px'],
        'lg':   ['16px', '24px'],
        'xl':   ['18px', '26px'],
        '2xl':  ['20px', '28px'],
        '3xl':  ['24px', '32px'],
        '4xl':  ['30px', '38px'],
        '5xl':  ['36px', '44px'],
      },
      borderRadius: {
        'xs': '4px',
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        'xs':  '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'sm':  '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
        'md':  '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.08)',
        'lg':  '0 10px 15px -3px rgb(0 0 0 / 0.08), 0 4px 6px -4px rgb(0 0 0 / 0.08)',
        'xl':  '0 20px 25px -5px rgb(0 0 0 / 0.08), 0 8px 10px -6px rgb(0 0 0 / 0.08)',
        'card': '0 2px 8px 0 rgb(7 43 87 / 0.06)',
        'card-hover': '0 8px 24px 0 rgb(7 43 87 / 0.12)',
        'map': '0 4px 20px 0 rgb(7 43 87 / 0.15)',
      },
      animation: {
        'fade-in':     'fadeIn 0.2s ease-out',
        'slide-up':    'slideUp 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'pulse-dot':   'pulseDot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow':   'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%':   { transform: 'translateY(8px)', opacity: '0' },
          '100%': { transform: 'translateY(0)',   opacity: '1' },
        },
        slideRight: {
          '0%':   { transform: 'translateX(-8px)', opacity: '0' },
          '100%': { transform: 'translateX(0)',    opacity: '1' },
        },
        pulseDot: {
          '0%, 100%': { opacity: '1' },
          '50%':      { opacity: '0.4' },
        },
      },
    },
  },
  plugins: [],
}

export default config
