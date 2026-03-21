import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@api': path.resolve(__dirname, './src/api'),
        '@auth': path.resolve(__dirname, './src/auth'),
        '@router': path.resolve(__dirname, './src/router'),
        '@layouts': path.resolve(__dirname, './src/layouts'),
        '@contexts': path.resolve(__dirname, './src/contexts'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@utils': path.resolve(__dirname, './src/utils'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL,
          changeOrigin: true,
        },
        '/auth': {
          target: env.VITE_API_URL,
          changeOrigin: true,
        },
        /**
         * Backend uses `/profile`, `/profile/me`, … — same path prefix as SPA route would collide.
         * Proxy only real API paths; do not proxy browser navigation to the SPA (Accept: text/html).
         */
        '/profile': {
          target: env.VITE_API_URL,
          changeOrigin: true,
          bypass(req) {
            const pathname = req.url?.split('?')[0] ?? '';
            if (pathname !== '/profile') {
              return undefined;
            }
            const accept = req.headers.accept ?? '';
            const mode = req.headers['sec-fetch-mode'];
            if (accept.includes('text/html') || mode === 'navigate') {
              return false;
            }
            return undefined;
          },
        },
        '/health': {
          target: env.VITE_API_URL,
          changeOrigin: true,
        },
      },
    },
  };
});
