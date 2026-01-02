/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  plugins: [],
  // чтобы Tailwind не ломал существующие CSS-стили (reset)
  corePlugins: { preflight: false },
};
