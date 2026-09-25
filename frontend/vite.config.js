import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateProductionApiUrl } from './config/production.js';

export default defineConfig(({ command, mode }) => {
  if (command === 'build') {
    validateProductionApiUrl(loadEnv(mode, process.cwd(), 'VITE_').VITE_API_BASE_URL);
  }
  return { plugins: [react()] };
});
