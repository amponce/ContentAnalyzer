import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';

// Note: PDF worker is now copied to the public/ directory
// and will be automatically included in the build

export default defineConfig({
  plugins: [
    react(),
    crx({ manifest }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  build: {
    emptyOutDir: true,
    // Increase the warning limit to avoid unnecessary warnings
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'index.html'),
        content: resolve(__dirname, 'src/content/index.ts'),
        background: resolve(__dirname, 'src/background/index.ts'),
        formViewer: resolve(__dirname, 'form-viewer.html')
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'content') {
            return 'content.js';
          }
          return chunk.name ? `${chunk.name.replace(/[\x00-\x1F\x7F]/g, '')}.js` : '[name].js';
        },
        chunkFileNames: (chunkInfo) => {
          // Sanitize chunk names to prevent issues
          const name = chunkInfo.name || '';
          // Remove null bytes and control characters
          const sanitizedName = name.replace(/[\x00-\x1F\x7F]/g, '');
          // Replace underscores (Chrome restriction)
          const finalName = sanitizedName.startsWith('_') ? `vite-${sanitizedName.slice(1)}` : sanitizedName;
          return `chunk-${finalName || 'unknown'}-[hash].js`;
        },
        assetFileNames: (assetInfo) => {
          // Sanitize asset filenames
          const info = assetInfo.name || '';
          const parts = info.split('/');
          const filename = parts.pop() || '';
          // Remove null bytes and control characters
          const sanitizedName = filename.replace(/[\x00-\x1F\x7F]/g, '');
          // Replace underscores (Chrome restriction)
          const finalName = sanitizedName.startsWith('_') ? `vite-${sanitizedName.slice(1)}` : sanitizedName;
          return `assets/${finalName || 'asset'}`;
        },
        // Prevent files from starting with underscores which Chrome restricts
        sanitizeFileName: (name) => {
          if (!name) return 'unknown';
          // Remove null bytes and control characters first
          const sanitized = name.replace(/[\x00-\x1F\x7F]/g, '');
          // Replace underscore prefix if present
          return sanitized.startsWith('_') ? `vite-${sanitized.slice(1)}` : sanitized;
        },
        // Implement manual chunk splitting
        manualChunks: (id) => {
          // Split PDF-related dependencies
          if (id.includes('pdfjs-dist') || id.includes('pdf-lib')) {
            return 'pdf-dependencies';
          }
          
          // Split React and related packages
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          
          // Split date-related libraries
          if (id.includes('date-fns') || 
              id.includes('react-day-picker')) {
            return 'date-vendor';
          }
          
          // Split UI components
          if (id.includes('node_modules/@radix-ui') || 
              id.includes('lucide-react')) {
            return 'ui-vendor';
          }
          
          // Split OpenAI related code
          if (id.includes('node_modules/openai')) {
            return 'openai-vendor';
          }
          
          // Keep components directory in its own chunk
          if (id.includes('/src/components/ui/')) {
            return 'ui-components';
          }
        }
      }
    }
  }
}); 