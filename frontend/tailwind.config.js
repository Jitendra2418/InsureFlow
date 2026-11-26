/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        olive: {
          50: '#F5F7F1',
          100: '#E7EBDD',
          200: '#D2DABF',
          300: '#B9C69E',
          400: '#9DB07E',
          500: '#8B9A6E', // User requested #8B9A6E / rgb(139, 154, 110)
          600: '#738258',
          700: '#5A6644',
          800: '#434D33',
          900: '#2E3523',
        },
        cream: '#F7F2EB', // User requested #F7F2EB / rgb(247, 242, 235)
        sand: {
          light: '#F3EFE8',
          DEFAULT: '#EAE2D6', // User requested #EAE2D6 / rgb(234, 226, 214)
          dark: '#D8CBB9',
        },
        softgray: '#EEEEEE', // User requested #EEEEEE / rgb(238, 238, 238)
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
