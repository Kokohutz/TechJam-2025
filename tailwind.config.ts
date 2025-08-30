const lynxPreset = require('@lynx-js/tailwind-preset');

/** @type {import('tailwindcss').Config} */
export default {
  mode: 'jit',
  presets: [lynxPreset], // Important: Use Lynx preset
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  purge: ['./src/**/*.{js,jsx,ts,tsx}'],
  plugins: [],
  theme: {
    extend: {
      colors: {
        primary: '#1677ff',
        danger: '#ff4d4f',
        success: '#52c41a',
      }
    }
  }
};