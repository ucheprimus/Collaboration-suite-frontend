import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor'
            if (id.includes('@supabase')) return 'supabase'
            if (id.includes('socket.io-client')) return 'socket'
            if (id.includes('@tiptap')) return 'editor'
            if (id.includes('react-bootstrap') || id.includes('bootstrap')) return 'ui'
            return 'vendor' // default fallback chunk
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
})
