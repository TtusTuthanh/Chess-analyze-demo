import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { addVariation, exportPgn, mainLine, parsePgn, PgnError, removeVariation } from './pgn';
import { SAMPLE_PGN } from './sample';
import { validateProject } from './project';
import { DEFAULT_THRESHOLDS } from './analysis';
import type { Game, Project } from '../types';
function tree(g: Game, id = g.root): unknown {
  const n = g.nodes[id];
  return {
    fen: n.fen,
    san: n.san,
    annotation: n.annotation,
    children: n.children.map((c) => tree(g, c)),
  };
}
describe('PGN move tree', () => {
  it('loads the sample mainline and checkmate', () => {
    const g = parsePgn(SAMPLE_PGN);
    expect(mainLine(g)).toHaveLength(33);
    expect(new Chess(mainLine(g).at(-1)!.fen).isCheckmate()).toBe(true);
    expect(Object.keys(g.nodes)).toHaveLength(36);
    expect(g.headers.ECO).toBe('C41');
  });
  it('round-trips headers, nested variations, comments and NAGs', () => {
    const g = parsePgn(
      '[Event "Escaped \\"quote\\" \\\\ path"]\n[Custom "keep me"]\n\n{Root note} 1.e4! {idea} (1.d4 d5 (1...Nf6 $5 2.c4) 2.c4) e5 2.Nf3?! Nc6 *',
    );
    const roundtrip = parsePgn(exportPgn(g));
    expect(roundtrip.headers).toEqual(g.headers);
    expect(tree(roundtrip)).toEqual(tree(g));
  });
  it('round-trips drawing directives without losing prose', () => {
    const g = parsePgn('1. e4 {Center [%cal Ge2e4,Rd1h5] [%csl Be4,Yf7]} e5 *');
    const n = mainLine(g)[0];
    expect(n.annotation.arrows).toHaveLength(2);
    expect(n.annotation.highlights).toHaveLength(2);
    expect(n.annotation.comment).toBe('Center');
    expect(tree(parsePgn(exportPgn(g)))).toEqual(tree(g));
  });
  it('supports black-to-move custom FEN and promotions', () => {
    const g = parsePgn('[SetUp "1"]\n[FEN "7k/8/8/8/8/8/p7/7K b - - 0 42"]\n42... a1=Q+ 43. Kh2 *');
    expect(mainLine(g)[0].ply).toBe(84);
    expect(mainLine(g)[0].uci).toBe('a2a1q');
    expect(tree(parsePgn(exportPgn(g)))).toEqual(tree(g));
  });
  it('preserves semicolon comments and adjacent NAGs', () => {
    const g = parsePgn('1.e4!$14 ; a line comment\ne5 *');
    expect(mainLine(g)[0].annotation.comment).toBe('a line comment');
    expect(mainLine(g)[0].annotation.nags).toEqual([1, 14]);
    expect(tree(parsePgn(exportPgn(g)))).toEqual(tree(g));
  });
  it('supports castles, captures and standard sample NAGs', () => {
    const g = parsePgn(SAMPLE_PGN);
    expect(mainLine(g).find((n) => n.san === 'O-O-O')).toBeTruthy();
    expect(mainLine(g).find((n) => n.san === 'Qb8+')!.annotation.nags).toEqual([3]);
  });
  it('identifies invalid token and line', () => {
    expect(() => parsePgn('1. e4 e5\n2. Nf3 Qz9')).toThrow('Line 2 · “Qz9”');
    expect(() => parsePgn('1. e4 e4')).toThrow(PgnError);
  });
  it.each(['1.e4 (1.d4', '1.e4 )', '1.e4 {note', '1. e4 }', '(1.e4)', '[Event "test"]', ''])(
    'rejects malformed or empty PGN without crashing: %s',
    (pgn) => {
      expect(() => parsePgn(pgn)).toThrow();
    },
  );
  it('rejects multi-game files with actionable error', () => {
    expect(() => parsePgn('1.e4 1-0\n1.d4 0-1')).toThrow('one game at a time');
  });
  it('adds, merges, and removes legal continuations transactionally', () => {
    const original = parsePgn('1. e4 e5 2. Nf3 *');
    const first = mainLine(original)[0];
    const { game, last } = addVariation(original, first.id, '1... c5 2. Nf3 d6');
    expect(game.nodes[last].san).toBe('d6');
    expect(game.nodes[first.id].children).toHaveLength(2);
    expect(original.nodes[first.id].children).toHaveLength(1);
    const merged = addVariation(game, first.id, 'c5 Nf3 d6').game;
    expect(Object.keys(merged.nodes)).toHaveLength(Object.keys(game.nodes).length);
    expect(() => addVariation(game, first.id, 'c5 Qh9')).toThrow();
    expect(tree(removeVariation(game, game.nodes[first.id].children[1]))).toEqual(tree(original));
    expect(() => removeVariation(game, game.nodes[first.id].children[0])).toThrow();
  });
});
describe('project validation', () => {
  const make = (): Project => ({
    version: 1,
    game: parsePgn(SAMPLE_PGN),
    current: 'root',
    analyses: {},
    settings: { depth: 12, multiPV: 1 },
    thresholds: DEFAULT_THRESHOLDS,
  });
  it('validates a complete saved project', () => {
    const p = make();
    expect(validateProject(JSON.parse(JSON.stringify(p)))).toEqual(p);
  });
  it('rejects cycles, missing nodes, and edited positions', () => {
    const cycle = make();
    cycle.game.nodes.root.children.push('root');
    expect(() => validateProject(cycle)).toThrow();
    const missing = make();
    missing.current = 'missing';
    expect(() => validateProject(missing)).toThrow();
    const position = make();
    mainLine(position.game)[0].fen = new Chess().fen();
    expect(() => validateProject(position)).toThrow();
  });
  it('rejects invalid engine state and thresholds', () => {
    const p = make();
    p.thresholds = { inaccuracy: 2, mistake: 1, blunder: 3 };
    expect(() => validateProject(p)).toThrow();
    expect(() => validateProject({ version: 2 })).toThrow();
  });
});
