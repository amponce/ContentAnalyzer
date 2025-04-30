const sharp = require('sharp');
const fs = require('fs');

const sizes = [16, 48, 128];

async function generateIcons() {
  const svgBuffer = fs.readFileSync('./icons/icon.svg');
  
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(`./icons/icon${size}.png`);
    console.log(`Generated icon${size}.png`);
  }
}

generateIcons().catch(console.error); 