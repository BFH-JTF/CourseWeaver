import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  envPrefix: ['VITE_', 'APP_', 'DATABASE_', 'POSTGRES_', 'OIDC_'],
  plugins: [
    vue(),
    vuetify({ autoImport: true }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/oidc': {
        target: 'http://localhost:3030',
        changeOrigin: false,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            const host = req.headers.host || 'localhost:5173'
            proxyReq.setHeader('x-forwarded-host', host)
            proxyReq.setHeader('x-forwarded-proto', req.headers['x-forwarded-proto'] || 'http')
          })
        },
      },
      '/socket.io': {
        target: 'http://localhost:3030',
        ws: true,
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})