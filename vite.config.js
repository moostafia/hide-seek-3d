import { defineConfig } from 'vite';

export default defineConfig({
  // Base path - use '/' for most deployments, adjust if deploying to subdirectory
  base: '/',
  
  build: {
    // Output to dist folder
    outDir: 'dist',
    // Generate source maps for easier debugging in production
    sourcemap: false,
    // Minify for production
    minify: 'esbuild',
    // Clear dist folder before build
    emptyOutDir: true,
  },
  
  server: {
    // Dev server settings
    port: 5173,
    // Proxy API requests to backend during development
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true,
        changeOrigin: true
      }
    }
  },
  
  preview: {
    port: 4173
  }
});
