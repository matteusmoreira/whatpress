import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 8000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  preview: {
    port: 8000,
    host: true
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ['ioredis', 'redis', 'bullmq']
  },
  build: {
    rollupOptions: {
      external: ['ioredis', 'redis', 'bullmq', 'events', 'stream', 'util', 'net', 'tls', 'fs', 'path', 'url', 'dns', 'child_process', 'worker_threads', 'assert']
    }
  }
})
