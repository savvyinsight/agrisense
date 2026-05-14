import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (
            id.includes('react') ||
            id.includes('react-dom') ||
            id.includes('react/jsx-runtime') ||
            id.includes('react-router-dom') ||
            id.includes('react-refresh')
          ) {
            return 'react-vendor'
          }

          if (id.includes('@mui/material') || id.includes('@mui/icons-material') || id.includes('@mui/x-charts') || id.includes('@mui/x-date-pickers')) {
            return 'mui-vendor'
          }

          if (id.includes('recharts') || id.includes('chart.js')) {
            return 'charts-vendor'
          }

          if (id.includes('i18next') || id.includes('react-i18next')) {
            return 'i18n-vendor'
          }

          if (id.includes('axios')) {
            return 'axios-vendor'
          }

          return undefined
        },
      },
    },
  },
})
