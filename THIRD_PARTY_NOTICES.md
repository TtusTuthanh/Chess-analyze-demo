# Third-party notices

## Stockfish 19 / Stockfish.js

The locally served JavaScript/WebAssembly engine is Stockfish.js 19, distributed
by Chess.com, based on Stockfish by Tord Romstad, Marco Costalba, Joona Kiiski,
Gary Linscott and other contributors. The lite neural network credits Chris Bao
(sscg13), as recorded in the engine's original file header. Those headers are
preserved without modification.

- License: GNU General Public License version 3; see `licenses/GPL-3.0.txt`.
- Stockfish.js corresponding source and build instructions:
  https://github.com/nmrugg/stockfish.js
- Native engine corresponding source: https://github.com/official-stockfish/Stockfish
- Installed artifact: npm `stockfish@19.0.0`, pinned by `package-lock.json`.
- This application copies the unmodified `stockfish-19-lite-single.js` and
  `stockfish-19-lite-single.wasm` artifacts at dev/build time. They are not
  committed to this repository.

When redistributing engine binaries, comply with GPLv3 including making the
matching corresponding source available. An upstream link alone does not
replace your source-distribution obligations. Build the engine from the matching
Stockfish.js source if producing a redistributed release.

## Chess pieces

The twelve SVG pieces in `public/pieces` are based on Colin M. L. Burnett's
(Cburnett) chess pieces, obtained from `chessboard-element@1.2.0`'s
`lib/wikipedia-pieces-svg.js`. Local modification: black fill colors changed to
charcoal; SVG content extracted into standalone files.

- Attribution: Colin M. L. Burnett, Wikimedia Commons.
- Source: https://commons.wikimedia.org/wiki/Category:SVG_chess_pieces
- Used under Creative Commons Attribution-ShareAlike 3.0:
  https://creativecommons.org/licenses/by-sa/3.0/
- These derived SVG assets remain under CC BY-SA 3.0.

## Inter

Inter font by Rasmus Andersson and contributors, obtained from
`@fontsource-variable/inter@5.3.0`. Licensed under SIL Open Font License 1.1;
the full license is at `public/fonts/OFL.txt`.

## Application dependencies

React / React DOM (MIT), Vite (MIT), chess.js (BSD-2-Clause), Lucide (ISC),
TypeScript (Apache-2.0), Vitest (MIT), Playwright (Apache-2.0).
Dependency licenses are available in their installed packages.
