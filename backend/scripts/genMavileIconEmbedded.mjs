import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pngPath = path.join(__dirname, '../src/infrastructure/email/assets/mavile-icon.png');
const outPath = path.join(__dirname, '../src/infrastructure/email/mavileIconEmbedded.ts');
const b64 = fs.readFileSync(pngPath).toString('base64');
fs.writeFileSync(
  outPath,
  `/** Auto-generated from assets/mavile-icon.png — run: node scripts/genMavileIconEmbedded.mjs */\nexport const MAVILE_ICON_DATA_URI = 'data:image/png;base64,${b64}';\n`,
);
