import { Chess } from 'chess.js';
import type { Annotation, Game, MoveNode, DrawingColor } from '../types';
export const NAGS: Record<number, string> = { 1: '!', 2: '?', 3: '!!', 4: '??', 5: '!?', 6: '?!' };
export const emptyAnnotation = (): Annotation => ({
  comment: '',
  nags: [],
  arrows: [],
  highlights: [],
});
const newId = () => crypto.randomUUID();
export class PgnError extends Error {
  constructor(
    public line: number,
    public token: string,
    reason: string,
  ) {
    super(`Line ${line} · “${token}”: ${reason}`);
  }
}
interface Token {
  value: string;
  line: number;
}
function tokenize(pgn: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  while (i < pgn.length) {
    const c = pgn[i];
    if (/\s/.test(c)) {
      if (c === '\n') line++;
      i++;
      continue;
    }
    if (c === ';') {
      const start = ++i;
      while (i < pgn.length && pgn[i] !== '\n') i++;
      tokens.push({ value: '{' + pgn.slice(start, i).replace(/[{}]/g, '') + '}', line });
      continue;
    }
    if (c === '%' && (i === 0 || pgn[i - 1] === '\n')) {
      while (i < pgn.length && pgn[i] !== '\n') i++;
      continue;
    }
    if (c === '{') {
      const start = i++,
        startLine = line;
      while (i < pgn.length && pgn[i] !== '}') {
        if (pgn[i] === '\n') line++;
        i++;
      }
      if (i === pgn.length)
        throw new PgnError(startLine, '{', 'Unclosed comment. Add a closing }.');
      tokens.push({ value: pgn.slice(start, ++i), line: startLine });
      continue;
    }
    if ('()'.includes(c)) {
      tokens.push({ value: c, line });
      i++;
      continue;
    }
    const start = i;
    while (i < pgn.length && !/[\s{}();]/.test(pgn[i])) i++;
    if (i === start) throw new PgnError(line, c, 'Unexpected character.');
    const value = pgn
      .slice(start, i)
      .replace(/^\d+\.(?:\.\.)?/, '')
      .replace(/^\.\.\./, '');
    if (value) {
      // NAGs can be adjacent to SAN or each other (e4!$14).
      const parts = value.split(/(\$\d+|[!?]{1,2})/).filter(Boolean);
      for (const part of parts) tokens.push({ value: part, line });
    }
  }
  return tokens;
}
function applyComment(node: MoveNode, value: string) {
  const text = value
    .slice(1, -1)
    .replace(/\[%cal\s+([^\]]+)\]/g, (_, list: string) => {
      for (const item of list.split(','))
        if (/^[GRBY][a-h][1-8][a-h][1-8]$/.test(item.trim())) {
          const s = item.trim();
          node.annotation.arrows.push({
            color: s[0] as DrawingColor,
            from: s.slice(1, 3),
            to: s.slice(3, 5),
          });
        }
      return '';
    })
    .replace(/\[%csl\s+([^\]]+)\]/g, (_, list: string) => {
      for (const item of list.split(','))
        if (/^[GRBY][a-h][1-8]$/.test(item.trim())) {
          const s = item.trim();
          node.annotation.highlights.push({ color: s[0] as DrawingColor, square: s.slice(1) });
        }
      return '';
    })
    .trim();
  node.annotation.comment = [node.annotation.comment, text].filter(Boolean).join('\n');
}
export function parsePgn(input: string): Game {
  if (input.length > 2_000_000)
    throw new Error('This PGN is too large. Please import one game under 2 MB.');
  const headers: Record<string, string> = {};
  const body = input.replace(
    /^\s*\[([A-Za-z0-9_]+)\s+"((?:\\.|[^"\\])*)"\s*\][ \t]*$/gm,
    (full, key: string, value: string) => {
      headers[key] = value.replace(/\\(["\\])/g, '$1');
      return full.replace(/[^\n]/g, ' ');
    },
  );
  let chess: Chess;
  try {
    chess = new Chess(headers.FEN);
  } catch {
    throw new PgnError(1, headers.FEN ?? 'FEN', 'Invalid starting FEN position.');
  }
  const fen = chess.fen();
  const ply = (Number(fen.split(' ')[5]) - 1) * 2 + (chess.turn() === 'b' ? 1 : 0);
  const root: MoveNode = {
    id: 'root',
    parent: null,
    children: [],
    ply,
    san: '',
    uci: '',
    fen,
    annotation: emptyAnnotation(),
  };
  const game: Game = { headers, nodes: { root }, root: 'root', originalPgn: input };
  let current = root;
  const stack: { id: string; line: number }[] = [];
  let ended = false;
  for (const t of tokenize(body)) {
    const v = t.value;
    if (v.startsWith('{')) {
      applyComment(current, v);
      continue;
    }
    if (v === '(') {
      if (!current.parent) throw new PgnError(t.line, v, 'A variation must follow a move.');
      if (stack.length >= 64)
        throw new PgnError(t.line, v, 'Variation nesting limit (64) exceeded.');
      stack.push({ id: current.id, line: t.line });
      current = game.nodes[current.parent];
      continue;
    }
    if (v === ')') {
      const last = stack.pop();
      if (!last) throw new PgnError(t.line, v, 'No matching opening parenthesis.');
      current = game.nodes[last.id];
      continue;
    }
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(v)) {
      if (!stack.length) {
        headers.Result ??= v;
        ended = true;
      }
      continue;
    }
    if (/^\$\d+$/.test(v) || /^[!?]{1,2}$/.test(v)) {
      const nag = v.startsWith('$')
        ? Number(v.slice(1))
        : Number(Object.keys(NAGS).find((k) => NAGS[Number(k)] === v));
      if (!Number.isFinite(nag)) throw new PgnError(t.line, v, 'Unknown annotation glyph.');
      current.annotation.nags.push(nag);
      continue;
    }
    if (ended && !stack.length)
      throw new PgnError(t.line, v, 'More than one game found. Import one game at a time.');
    try {
      chess = new Chess(current.fen);
      const move = chess.move(v);
      const node: MoveNode = {
        id: newId(),
        parent: current.id,
        children: [],
        ply: current.ply + 1,
        san: move.san,
        uci: move.from + move.to + (move.promotion ?? ''),
        fen: chess.fen(),
        annotation: emptyAnnotation(),
      };
      current.children.push(node.id);
      game.nodes[node.id] = node;
      current = node;
    } catch {
      throw new PgnError(
        t.line,
        v,
        `Illegal or unrecognized move. ${current.fen.split(' ')[1] === 'w' ? 'White' : 'Black'} to move after ${current.san || 'the starting position'}.`,
      );
    }
  }
  if (stack.length)
    throw new PgnError(stack.at(-1)!.line, '(', 'Unclosed variation. Add a closing ).');
  if (!root.children.length)
    throw new Error('No moves found. Paste a PGN containing at least one legal move.');
  headers.Result ??= '*';
  return game;
}
export function mainLine(game: Game, start = game.root): MoveNode[] {
  const nodes: MoveNode[] = [];
  let current = game.nodes[start];
  while (current.children.length) {
    current = game.nodes[current.children[0]];
    nodes.push(current);
  }
  return nodes;
}
export function pathTo(game: Game, id: string): MoveNode[] {
  const result: MoveNode[] = [];
  let node = game.nodes[id];
  while (node.parent) {
    result.unshift(node);
    node = game.nodes[node.parent];
  }
  return result;
}
export function moveLabel(node: MoveNode) {
  return `${Math.ceil(node.ply / 2)}${node.ply % 2 ? '.' : '...'} ${node.san}`;
}
function annotationPgn(a: Annotation) {
  const text = a.comment.replace(/[{}]/g, (m) => (m === '{' ? '(' : ')'));
  const arrows = a.arrows.length
    ? `[%cal ${a.arrows.map((v) => v.color + v.from + v.to).join(',')}]`
    : '';
  const squares = a.highlights.length
    ? `[%csl ${a.highlights.map((v) => v.color + v.square).join(',')}]`
    : '';
  const comment = [text, arrows, squares].filter(Boolean).join(' ');
  return `${a.nags.map((n) => ` $${n}`).join('')}${comment ? ` {${comment}}` : ''}`;
}
export function exportPgn(game: Game): string {
  const headers = Object.entries(game.headers)
    .map(([k, v]) => `[${k} "${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`)
    .join('\n');
  function line(id: string): string {
    const node = game.nodes[id];
    return `${moveLabel(node)}${annotationPgn(node.annotation)}${children(node)}`;
  }
  function children(parent: MoveNode): string {
    if (!parent.children.length) return '';
    const first = game.nodes[parent.children[0]];
    return ` ${moveLabel(first)}${annotationPgn(first.annotation)}${parent.children
      .slice(1)
      .map((id) => ` (${line(id)})`)
      .join('')}${children(first)}`;
  }
  return `${headers}\n\n${annotationPgn(game.nodes[game.root].annotation).trim()}${children(game.nodes[game.root])} ${game.headers.Result ?? '*'}`.trim();
}
export function addVariation(game: Game, at: string, text: string): { game: Game; last: string } {
  const clone = structuredClone(game);
  let current = clone.nodes[at];
  let count = 0;
  for (const token of tokenize(text)) {
    if (/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token.value)) continue;
    const chess = new Chess(current.fen);
    try {
      const move = chess.move(token.value);
      const uci = move.from + move.to + (move.promotion ?? '');
      const exists = current.children.map((id) => clone.nodes[id]).find((n) => n.uci === uci);
      if (exists) current = exists;
      else {
        const node: MoveNode = {
          id: newId(),
          parent: current.id,
          children: [],
          ply: current.ply + 1,
          san: move.san,
          uci,
          fen: chess.fen(),
          annotation: emptyAnnotation(),
        };
        current.children.push(node.id);
        clone.nodes[node.id] = node;
        current = node;
      }
      count++;
    } catch {
      throw new PgnError(
        token.line,
        token.value,
        'Not a legal continuation of this position. Enter SAN or UCI moves, e.g. Nf3 Nc6.',
      );
    }
  }
  if (!count) throw new Error('Enter at least one move.');
  return { game: clone, last: current.id };
}
export function removeVariation(game: Game, id: string): Game {
  const next = structuredClone(game);
  const node = next.nodes[id];
  if (!node.parent || next.nodes[node.parent].children[0] === id)
    throw new Error('Only alternative variations can be removed.');
  next.nodes[node.parent].children = next.nodes[node.parent].children.filter((v) => v !== id);
  const remove = (key: string) => {
    next.nodes[key].children.forEach(remove);
    delete next.nodes[key];
  };
  remove(id);
  return next;
}
