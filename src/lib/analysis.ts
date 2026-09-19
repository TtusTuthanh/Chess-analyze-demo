import { Chess } from 'chess.js';
import type { EngineAnalysis, Game, MoveAssessment, MoveNode, Thresholds } from '../types';
import { mainLine, moveLabel } from './pgn';
import { evaluationText, uciToSan } from './engine';
export const DEFAULT_THRESHOLDS: Thresholds = { inaccuracy: 0.3, mistake: 0.8, blunder: 1.5 };
export function assessMove(
  game: Game,
  node: MoveNode,
  cache: Record<string, EngineAnalysis>,
  thresholds = DEFAULT_THRESHOLDS,
): MoveAssessment | undefined {
  if (!node.parent) return;
  const before = cache[game.nodes[node.parent].fen],
    after = cache[node.fen];
  if (!before?.complete || !after?.complete) return;
  const side = game.nodes[node.parent].fen.split(' ')[1] === 'w' ? 1 : -1;
  const best = uciToSan(before.fen, [before.bestMove])[0] ?? '—';
  const common = {
    before,
    after,
    best,
    mateChange: before.mate !== undefined || after.mate !== undefined,
  };
  if (common.mateChange) {
    const winningBefore = before.mate !== undefined && before.cp * side > 0;
    const winningAfter = after.mate !== undefined && after.cp * side > 0;
    const losingBefore = before.mate !== undefined && before.cp * side < 0;
    const losingAfter = after.mate !== undefined && after.cp * side < 0;
    return {
      ...common,
      loss: null,
      label:
        winningBefore && !winningAfter
          ? 'Missed win'
          : losingAfter && !losingBefore
            ? 'Blunder'
            : node.uci === before.bestMove
              ? 'Best move'
              : 'Good',
    };
  }
  const loss = Math.max(0, ((before.cp - after.cp) * side) / 100);
  const label =
    loss > thresholds.blunder
      ? 'Blunder'
      : loss >= thresholds.mistake
        ? 'Mistake'
        : loss >= thresholds.inaccuracy
          ? 'Inaccuracy'
          : node.uci === before.bestMove
            ? 'Best move'
            : 'Good';
  return { ...common, loss, label };
}
export function phase(node: MoveNode): 'Opening' | 'Middlegame' | 'Endgame' {
  const chess = new Chess(node.fen);
  const values: Record<string, number> = { p: 0, n: 3, b: 3, r: 5, q: 9, k: 0 };
  const material = chess
    .board()
    .flat()
    .reduce((sum, piece) => sum + (piece ? values[piece.type] : 0), 0);
  return material <= 26 ? 'Endgame' : node.ply <= 16 ? 'Opening' : 'Middlegame';
}
export function buildReport(
  game: Game,
  cache: Record<string, EngineAnalysis>,
  thresholds: Thresholds,
) {
  const line = mainLine(game);
  const assessed = line
    .map((n) => ({ node: n, assessment: assessMove(game, n, cache, thresholds) }))
    .filter((x) => x.assessment !== undefined);
  const accuracy = (side: number) => {
    const moves = assessed.filter((x) => x.node.ply % 2 === side);
    if (!moves.length) return null;
    return Math.round(
      moves.reduce(
        (s, x) =>
          s +
          100 *
            Math.exp(
              -0.35 *
                (x.assessment!.loss ??
                  (['Missed win', 'Blunder'].includes(x.assessment!.label) ? 10 : 0)),
            ),
        0,
      ) / moves.length,
    );
  };
  return {
    title: `${game.headers.White ?? 'White'} vs ${game.headers.Black ?? 'Black'}`,
    result: game.headers.Result,
    opening: game.headers.Opening ?? 'Not identified',
    eco: game.headers.ECO,
    totalPlies: line.length,
    totalMoves: Math.ceil(line.length / 2),
    analyzedPlies: assessed.length,
    complete: assessed.length === line.length,
    accuracy: { white: accuracy(1), black: accuracy(0) },
    accuracyNote:
      'Approximate heuristic (100 × exp(−0.35 × pawn loss)), not an official accuracy rating. Mate swings are scored separately.',
    phases: ['Opening', 'Middlegame', 'Endgame'].map((p) => ({
      phase: p,
      plies: line.filter((n) => phase(n) === p).length,
      errors: assessed.filter(
        (x) =>
          phase(x.node) === p &&
          ['Blunder', 'Mistake', 'Inaccuracy', 'Missed win'].includes(x.assessment!.label),
      ).length,
    })),
    critical: assessed
      .filter((x) =>
        ['Blunder', 'Mistake', 'Inaccuracy', 'Missed win'].includes(x.assessment!.label),
      )
      .sort((a, b) => (b.assessment!.loss ?? 100) - (a.assessment!.loss ?? 100))
      .slice(0, 10)
      .map((x) => ({
        id: x.node.id,
        played: moveLabel(x.node),
        best: x.assessment!.best,
        before: evaluationText(x.assessment!.before),
        after: evaluationText(x.assessment!.after),
        loss: x.assessment!.loss,
        classification: x.assessment!.label,
        phase: phase(x.node),
      })),
  };
}
export type Report = ReturnType<typeof buildReport>;
export function reportMarkdown(r: Report) {
  return `# ${r.title}\n\nResult: ${r.result}\nOpening: ${r.opening}\nMoves: ${r.totalMoves}\nAnalyzed: ${r.analyzedPlies}/${r.totalPlies} plies\n\n## Approximate accuracy\nWhite: ${r.accuracy.white ?? '—'}%\nBlack: ${r.accuracy.black ?? '—'}%\n\n${r.accuracyNote}\n\n## Critical moments\n${r.critical.map((c) => `- **${c.played} — ${c.classification}**. Best: ${c.best}. Evaluation: ${c.before} → ${c.after}. Loss: ${c.loss === null ? 'mate transition' : c.loss.toFixed(2) + ' pawns'}.`).join('\n') || 'No classified errors in the analyzed positions.'}\n\n## Approximate phases\n${r.phases.map((p) => `- ${p.phase}: ${p.plies} plies, ${p.errors} classified errors`).join('\n')}\n\nAll evaluations are from White’s perspective. No speculative tactical explanations are generated.\n`;
}
