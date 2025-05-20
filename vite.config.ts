import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'fs';

// Note: PDF worker is now copied to the public/ directory
// and will be automatically included in the build

/**
 * Multi-Agent Form Processing Architecture
 * ----------------------------------------
 * This configuration supports a multi-agent approach to form processing:
 * 
 * 1. Parsing Agent: OCR and text extraction from forms
 *    - Specialized in document structure and layout analysis
 *    - Identifies form fields, labels, and values with high accuracy
 *    - Processes multi-page documents and complex layouts
 * 
 * 2. Builder Agent: Transforms raw extracted data into structured form objects
 *    - Validates field values against expected formats
 *    - Resolves ambiguities in field identification
 *    - Groups related fields into logical sections
 * 
 * 3. Design Agent: Creates user-friendly form layouts from structured data
 *    - Implements multi-step navigation for complex forms
 *    - Optimizes field arrangement for better usability
 *    - Applies appropriate UI components for different field types
 * 
 * 4. QA Agent: Verifies extraction accuracy and completeness
 *    - Identifies potentially missing required fields
 *    - Checks for inconsistencies in the extracted data
 *    - Provides confidence scores for the overall form processing
 * 
 * This approach ensures modularity, specialization, scalability, and robustness
 * in the form processing pipeline.
 */

// Prepare icons before build
function prepareIcons() {
  try {
    // Copy icons to public root for manifest processing during build
    const iconSizes = [16, 48, 128];
    iconSizes.forEach(size => {
      const source = `./public/icons/icon${size}.png`;
      const destination = `./public/icon${size}.png`;
      try {
        const data = readFileSync(source);
        writeFileSync(destination, data);
        console.log(`Prepared: Copied ${source} to ${destination}`);
      } catch (error) {
        console.error(`Error preparing icon${size}.png:`, error);
      }
    });
    return true;
  } catch (error) {
    console.error('Error preparing icons:', error);
    return false;
  }
}

// Copy files after build
function copyIconsPostBuild() {
  try {
    // Make sure dist directory exists
    if (!existsSync('./dist')) {
      mkdirSync('./dist', { recursive: true });
    }
    
    // Copy icons to dist root for Chrome to find
    const iconSizes = [16, 48, 128];
    iconSizes.forEach(size => {
      const source = `./public/icons/icon${size}.png`;
      const destination = `./dist/icon${size}.png`;
      try {
        const data = readFileSync(source);
        writeFileSync(destination, data);
        console.log(`Post-build: Copied ${source} to ${destination}`);
      } catch (error) {
        console.error(`Error copying icon${size}.png:`, error);
      }
    });
    return true;
  } catch (error) {
    console.error('Error copying icons:', error);
    return false;
  }
}

// Prepare icons before configuration
prepareIcons();

export default defineConfig({
  plugins: [
    {
      name: 'pre-build-setup',
      buildStart() {
        // Run icon preparation again in case it was missed
        prepareIcons();
      }
    },
    react(),
    crx({ manifest }),
    {
      name: 'post-build-setup',
      closeBundle() {
        copyIconsPostBuild();
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // Agent-specific module paths
      '@agents': resolve(__dirname, './src/lib/agents'),
      '@parser': resolve(__dirname, './src/lib/agents/parser'),
      '@builder': resolve(__dirname, './src/lib/agents/builder'),
      '@designer': resolve(__dirname, './src/lib/agents/designer'),
      '@qa': resolve(__dirname, './src/lib/agents/qa'),
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
        // Implement manual chunk splitting with agent-specific chunks
        manualChunks: (id) => {
          // Agent-specific chunks
          if (id.includes('/agents/parser/')) {
            return 'agent-parser';
          }
          if (id.includes('/agents/builder/')) {
            return 'agent-builder';
          }
          if (id.includes('/agents/designer/')) {
            return 'agent-designer';
          }
          if (id.includes('/agents/qa/')) {
            return 'agent-qa';
          }
          
          // PDF-related dependencies
          if (id.includes('pdfjs-dist') || id.includes('pdf-lib')) {
            return 'pdf-dependencies';
          }
          
          // React and related packages
          if (id.includes('node_modules/react') || 
              id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }
          
          // Date-related libraries
          if (id.includes('date-fns') || 
              id.includes('react-day-picker')) {
            return 'date-vendor';
          }
          
          // UI components
          if (id.includes('node_modules/@radix-ui') || 
              id.includes('lucide-react')) {
            return 'ui-vendor';
          }
          
          // OpenAI related code
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
  },
  publicDir: 'public'
}); 