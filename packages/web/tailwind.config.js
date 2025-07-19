import { radixThemePreset } from 'radix-themes-tw';

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        purple1: '#261327',
        purple2: '#421f45',
        purple3: '#5d2f61',
        purple4: '#77427a',
        purple5: '#8f5892',
        purple6: '#a670a8',
        purple7: '#bb8abd',
        purple8: '#cea5d0',
        purple9: '#e0c2e1',
        purple10: '#f1e0f1',
      },
    },
  },
  plugins: [],
  presets: [radixThemePreset],
};
