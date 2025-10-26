import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase': ['@supabase/supabase-js'],
          'socket': ['socket.io-client'],
          'editor': ['@tiptap/react', '@tiptap/starter-kit'],
          'ui': ['react-bootstrap', 'bootstrap']
        }
      }
    },
    chunkSizeWarningLimit: 1000
  }
})