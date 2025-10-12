/**
 * PWA Icon Generator Script
 * 
 * This script generates all required PWA icons from a source image.
 * 
 * Usage:
 * 1. Place your source logo (at least 512x512 PNG) in the public folder
 * 2. Update the SOURCE_IMAGE path below
 * 3. Run: node generate-icons.js
 * 
 * Requirements: npm install sharp
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const SOURCE_IMAGE = './public/placeholder-logo.png'; // Change this to your logo
const OUTPUT_DIR = './public';

// Icon sizes to generate
const ICON_SIZES = [
  { size: 72, name: 'icon-72x72.png' },
  { size: 96, name: 'icon-96x96.png' },
  { size: 128, name: 'icon-128x128.png' },
  { size: 144, name: 'icon-144x144.png' },
  { size: 152, name: 'icon-152x152.png' },
  { size: 192, name: 'icon-192x192.png' },
  { size: 384, name: 'icon-384x384.png' },
  { size: 512, name: 'icon-512x512.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 32, name: 'favicon.ico' },
];

async function generateIcons() {
  try {
    // Check if source image exists
    if (!fs.existsSync(SOURCE_IMAGE)) {
      console.error(`❌ Source image not found: ${SOURCE_IMAGE}`);
      console.log('\n📝 Please:');
      console.log('1. Place your logo (at least 512x512 PNG) in the public folder');
      console.log('2. Update SOURCE_IMAGE in this script to point to your logo');
      process.exit(1);
    }

    console.log('🎨 Generating PWA icons...\n');

    // Generate each icon size
    for (const { size, name } of ICON_SIZES) {
      const outputPath = path.join(OUTPUT_DIR, name);
      
      await sharp(SOURCE_IMAGE)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 } // Transparent background
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ Generated ${name} (${size}x${size})`);
    }

    console.log('\n🎉 All icons generated successfully!');
    console.log('\n📱 Next steps:');
    console.log('1. Review the generated icons in the public folder');
    console.log('2. Run: npm run build');
    console.log('3. Run: npm run start');
    console.log('4. Open Chrome DevTools → Application → Manifest to verify');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    console.log('\n💡 Make sure you have sharp installed:');
    console.log('   npm install sharp --save-dev');
    process.exit(1);
  }
}

// Run the generator
generateIcons();

