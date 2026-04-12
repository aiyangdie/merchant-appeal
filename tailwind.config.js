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
          gray: '#F5F5F5',
          border: '#E5E5E5',
        },
      },
      borderRadius: {
        'sm': '6px',
        'md': '10px',
        'lg': '14px',
      },
      boxShadow: {
        'sm': '0 1px 2px rgba(0,0,0,0.04)',
        'md': '0 2px 8px rgba(0,0,0,0.06)',
        'lg': '0 4px 16px rgba(0,0,0,0.08)',
      },
      transitionDuration: {
        '150': '150ms',
      },
    },
  },
  plugins: [],
}
