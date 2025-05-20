import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define paths
const srcIconsDir = path.join(__dirname, 'public', 'icons');
const distDir = path.join(__dirname, 'dist');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Copy icon files directly to dist directory
const iconSizes = [16, 48, 128];
iconSizes.forEach(size => {
  const srcPath = path.join(srcIconsDir, `icon${size}.png`);
  const destPath = path.join(distDir, `icon${size}.png`);
  
  // Read the source file
  try {
    const data = fs.readFileSync(srcPath);
    
    // Write to destination
    fs.writeFileSync(destPath, data);
    console.log(`Successfully copied ${srcPath} to ${destPath}`);
  } catch (error) {
    console.error(`Error copying icon${size}.png:`, error);
  }
});

console.log('Icon files fixed.'); 