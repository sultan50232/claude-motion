#!/usr/bin/env node
// Inlines the Arabic fonts as base64 so the bundled page works offline: writes fonts.gen.js.
//   node sims/tolerance/fonts.mjs
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const b64 = (f) => fs.readFileSync(path.join(HERE, 'fonts', f)).toString('base64');
fs.writeFileSync(path.join(HERE, 'fonts.gen.js'),
  `export const AMIRI = '${b64('Amiri-Bold.ttf')}';\nexport const KUFI = '${b64('ReemKufi.ttf')}';\nexport const TAJAWAL = '${b64('Tajawal-Bold.ttf')}';\n`);
console.log('fonts.gen.js written');
