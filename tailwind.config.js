import baseConfig from '@hello-world-co-op/ui/tailwind.config.js';

/** @type {import('tailwindcss').Config} */
export default {
  ...baseConfig,
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/@hello-world-co-op/ui/dist/**/*.js',
  ],
  theme: {
    extend: {
      ...baseConfig.theme.extend,
      // Suite-specific theme extensions can go here
    },
  },
};
