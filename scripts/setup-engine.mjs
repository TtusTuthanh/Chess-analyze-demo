import { mkdir, copyFile } from 'node:fs/promises';
await mkdir('public/engine', { recursive: true });
for (const ext of ['js', 'wasm'])
  await copyFile(
    `node_modules/stockfish/bin/stockfish-19-lite-single.${ext}`,
    `public/engine/stockfish-19-lite-single.${ext}`,
  );
await copyFile('licenses/GPL-3.0.txt', 'public/engine/LICENSE.txt');
