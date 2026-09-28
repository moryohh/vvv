import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  base: '/vvv/',
  plugins: [react()],
  server: { port: 5173, open: '/app.html' },
  build: { rollupOptions: { input: 'app.html' } }
});
