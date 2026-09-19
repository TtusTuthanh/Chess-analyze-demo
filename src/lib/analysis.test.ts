import { describe, expect, it } from 'vitest';
import type { EngineAnalysis } from '../types';
import { assessMove, buildReport, DEFAULT_THRESHOLDS, reportMarkdown } from './analysis';
import { evaluationText, uciToSan } from './engine';
import { mainLine, parsePgn } from './pgn';
const a = (fen: string, cp: number, mate?: number): EngineAnalysis => ({
  fen,
  cp,
  mate,
  depth: 14,
  bestMove: 'd2d4',
  lines: [],
  nodes: 100,
  nps: 500,
  timestamp: 1,
  complete: true,
  multiPV: 1,
});
describe('engine assessment', () => {
  it.each([
    [20, 'Good'],
    [30, 'Inaccuracy'],
    [79, 'Inaccuracy'],
    [80, 'Mistake'],
    [150, 'Mistake'],
    [151, 'Blunder'],
  ])('classifies %i centipawn loss as %s', (loss, label) => {
    const g = parsePgn('1.e4 e5 *');
    const n = mainLine(g)[0];
    const cache = { [g.nodes.root.fen]: a(g.nodes.root.fen, 0), [n.fen]: a(n.fen, -Number(loss)) };
    expect(assessMove(g, n, cache)?.label).toBe(label);
  });
  it('normalizes loss to Black’s perspective', () => {
    const g = parsePgn('1.e4 e5 *');
    const [before, after] = mainLine(g);
    const cache = { [before.fen]: a(before.fen, 0), [after.fen]: a(after.fen, 220) };
    expect(assessMove(g, after, cache)?.loss).toBe(2.2);
    expect(assessMove(g, after, cache)?.label).toBe('Blunder');
  });
  it('never reports a negative loss and recognizes best move', () => {
    const g = parsePgn('1.e4 *');
    const n = mainLine(g)[0];
    const before = a(g.nodes.root.fen, 0);
    before.bestMove = n.uci;
    expect(assessMove(g, n, { [before.fen]: before, [n.fen]: a(n.fen, 20) })?.label).toBe(
      'Best move',
    );
    expect(assessMove(g, n, { [before.fen]: before, [n.fen]: a(n.fen, 20) })?.loss).toBe(0);
  });
  it('handles lost forced wins and allowed mates without fake centipawn arithmetic', () => {
    const g = parsePgn('1.e4 *');
    const n = mainLine(g)[0];
    const lost = assessMove(g, n, {
      [g.nodes.root.fen]: a(g.nodes.root.fen, 100000, 3),
      [n.fen]: a(n.fen, 100),
    });
    expect(lost?.label).toBe('Missed win');
    expect(lost?.loss).toBeNull();
    expect(
      assessMove(g, n, {
        [g.nodes.root.fen]: a(g.nodes.root.fen, 0),
        [n.fen]: a(n.fen, -100000, -2),
      })?.label,
    ).toBe('Blunder');
  });
  it('requires completed before and after results', () => {
    const g = parsePgn('1.e4 *');
    const n = mainLine(g)[0];
    const before = a(g.nodes.root.fen, 10);
    before.complete = false;
    expect(assessMove(g, n, { [before.fen]: before, [n.fen]: a(n.fen, 0) })).toBeUndefined();
  });
  it('accepts configurable thresholds', () => {
    const g = parsePgn('1.e4 *');
    const n = mainLine(g)[0];
    const cache = { [g.nodes.root.fen]: a(g.nodes.root.fen, 100), [n.fen]: a(n.fen, 0) };
    expect(assessMove(g, n, cache, { inaccuracy: 2, mistake: 3, blunder: 4 })?.label).toBe('Good');
  });
  it('converts UCI PV into SAN and formats mate and pawn scores', () => {
    const g = parsePgn('1.e4 *');
    expect(uciToSan(g.nodes.root.fen, ['e2e4', 'e7e5', 'g1f3'])).toEqual(['e4', 'e5', 'Nf3']);
    expect(evaluationText({ cp: 125 })).toBe('+1.25');
    expect(evaluationText({ cp: -100000, mate: -3 })).toBe('−M3');
  });
  it('makes partial reports explicit without invented reasons', () => {
    const g = parsePgn('1.e4 e5 *');
    const r = buildReport(g, {}, DEFAULT_THRESHOLDS);
    expect(r.complete).toBe(false);
    expect(r.accuracy.white).toBeNull();
    expect(r.critical).toEqual([]);
    expect(reportMarkdown(r)).toContain('No speculative tactical explanations');
  });
});
