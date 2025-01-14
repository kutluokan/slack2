module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  safelist: [
    'opacity-0',
    'opacity-100',
    'group-hover:opacity-100',
    'transition-opacity',
    'duration-200'
  ]
} 