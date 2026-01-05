import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');

const svgContent = readFileSync(join(iconsDir, 'icon.svg'), 'utf8');

const sizes = [16, 48, 128];

for (const size of sizes) {
  const resvg = new Resvg(svgContent, {
    fitTo: {
      mode: 'width',
      value: size,
    },
  });

  const pngData = resvg.render();
  const pngBuffer = pngData.asPng();

  const outputPath = join(iconsDir, `icon-${size}.png`);
  writeFileSync(outputPath, pngBuffer);
  console.log(`Generated: icon-${size}.png`);
}

console.log('All icons generated successfully!');
