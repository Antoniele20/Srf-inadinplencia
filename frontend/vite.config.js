import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Em desenvolvimento, as chamadas para /api são repassadas à API em ASP.NET Core.
// Assim o navegador fala com um endereço só e não há problema de CORS.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_PROXY_API || 'http://localhost:5080',
          changeOrigin: true,
        },
      },
    },
  };
});
