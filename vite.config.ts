import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// Security validation - prevent auth bypass in production builds
if (process.env.NODE_ENV === 'production') {
  if (process.env.VITE_DEV_AUTH_BYPASS === 'true') {
    throw new Error(
      '[SECURITY] CRITICAL: VITE_DEV_AUTH_BYPASS=true is set in production build. ' +
        'This is a security vulnerability. Remove this environment variable.'
    );
  }
  if (process.env.VITE_E2E_AUTH_BYPASS === 'true') {
    throw new Error(
      '[SECURITY] CRITICAL: VITE_E2E_AUTH_BYPASS=true is set in production build. ' +
        'This is a security vulnerability. Remove this environment variable.'
    );
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    host: true,
  },
  envPrefix: 'VITE_',
  build: {
    outDir: 'dist',
    sourcemap: true,
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
          ui: ['@hello-world-co-op/ui'],
          auth: ['@hello-world-co-op/auth'],
          api: ['@hello-world-co-op/api'],
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
});
