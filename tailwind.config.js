/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        wechat: {
          green: '#07C160',
          dark: '#1A1A1A',
          gray: '#F7F7F7',
          border: '#E5E5E5',
        },
      },
    },
  },
  plugins: [],
}
