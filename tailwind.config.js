/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#F5F0FC',
          100: '#EAE0F8',
          200: '#D3BCF0',
          300: '#B390E3',
          400: '#9468D4',
          500: '#8B6BBF',
          600: '#7B5CAE',
          700: '#6448A0',
          800: '#4D3580',
          900: '#382255',
          950: '#1E1240',
        },
        teal: {
          50:  '#F0FAFA',
          100: '#CCEFEE',
          200: '#99DFDD',
          300: '#60CCCB',
          400: '#42BCB4',
          500: '#32A8A0',
          600: '#268880',
          700: '#1E6B65',
          800: '#174E4A',
          900: '#0F3230',
        },
        rose: {
          50:  '#FDF0F4',
          100: '#FAD9E5',
          200: '#F4AECA',
          300: '#EC7FAA',
          400: '#DC5590',
          500: '#CC6888',
          600: '#B34F72',
          700: '#8F3A59',
          800: '#6B2843',
          900: '#46182C',
        },
      },
    },
  },
  plugins: [],
};
