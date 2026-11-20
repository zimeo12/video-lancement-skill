/**
 * Images fixes de controle, un seul bundle pour toutes : node scripts/stills.mjs 120,400,... [en|fr|both] [dossier]
 */
import path from 'node:path';
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';

const [frames = '0', langs = 'both', dir = 'out/qa'] = process.argv.slice(2);
const root = path.resolve(import.meta.dirname, '..');
const serveUrl = await bundle({ entryPoint: path.join(root, 'src/index.ts'), publicDir: path.join(root, 'public') });
for (const lang of langs === 'both' ? ['en', 'fr'] : [langs]) {
  const composition = await selectComposition({ serveUrl, id: process.env.COMP ?? 'Launch', inputProps: { lang }, browserExecutable: process.env.REMOTION_CHROME ?? null });
  for (const f of frames.split(',').map(Number)) {
    const output = path.join(root, dir, `${lang}-${String(f).padStart(4, '0')}.jpg`);
    await renderStill({ serveUrl, composition, frame: f, output, inputProps: { lang }, imageFormat: 'jpeg', jpegQuality: 88, browserExecutable: process.env.REMOTION_CHROME ?? null });
    console.log(output);
  }
}
