import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const STANDARD_SIZE = 800;
const INPUT_DIR = './attached_assets';
const OUTPUT_DIR = './client/public/images/menu';

const menuImages = [
  'Triple Smash Set - 27.11.2023_1760967989404.jpg',
  'Single Smash Set - 27.11.2023_1760967990961.jpg',
  'Super Double Set - 27.11.2023_1760967991310.jpg',
  'Karaage Chicken Burger - Meal Deal_1760967991446.png',
  'Double Set - 27.11.2023_1760967955147.jpg',
];

const outputNames = [
  'triple-smash-set.jpg',
  'single-smash-set.jpg',
  'super-double-set.jpg',
  'karaage-chicken-burger-meal-deal.jpg',
  'double-set.jpg',
];

async function processImages() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Processing ${menuImages.length} menu images...`);
  console.log(`Standard size: ${STANDARD_SIZE}x${STANDARD_SIZE}px\n`);

  for (let i = 0; i < menuImages.length; i++) {
    const inputPath = path.join(INPUT_DIR, menuImages[i]);
    const outputPath = path.join(OUTPUT_DIR, outputNames[i]);

    try {
      const metadata = await sharp(inputPath).metadata();
      console.log(`${menuImages[i]}: ${metadata.width}x${metadata.height}`);

      await sharp(inputPath)
        .resize(STANDARD_SIZE, STANDARD_SIZE, {
          fit: 'cover',
          position: 'center',
        })
        .jpeg({ quality: 90 })
        .toFile(outputPath);

      console.log(`  ✅ Saved to: ${outputPath}\n`);
    } catch (error) {
      console.error(`  ❌ Error processing ${menuImages[i]}:`, error);
    }
  }

  console.log('✅ All images processed successfully!');
}

processImages().catch(console.error);
