import { Chess } from 'chess.js';
import type { Project } from '../types';
export function validateProject(input: unknown): Project {
  const p = input as Project;
  const fail = () => {
    throw new Error(
      'Invalid project JSON. Import a version 1 project exported by Chess PGN Analyzer.',
    );
  };
  if (
    !p ||
    p.version !== 1 ||
    !p.game ||
    !p.game.nodes ||
    !p.game.headers ||
    typeof p.game.originalPgn !== 'string' ||
    !p.settings ||
    !p.analyses ||
    !p.thresholds
  )
    return fail();
  if (
    Object.values(p.game.headers).some((v) => typeof v !== 'string') ||
    !Object.keys(p.game.headers).every((k) => /^[A-Za-z0-9_]+$/.test(k))
  )
    return fail();
  if (
    ![1, 2, 3, 5].includes(p.settings.multiPV) ||
    !Number.isInteger(p.settings.depth) ||
    p.settings.depth < 8 ||
    p.settings.depth > 22
  )
    return fail();
  if (!(
    p.thresholds.inaccuracy > 0 &&
    p.thresholds.inaccuracy < p.thresholds.mistake &&
    p.thresholds.mistake < p.thresholds.blunder
  ))
    return fail();
  const nodes = p.game.nodes;
  const keys = Object.keys(nodes);
  if (
    keys.length > 10000 ||
    !nodes[p.game.root] ||
    !nodes[p.current] ||
    nodes[p.game.root].parent !== null
  )
    return fail();
  const visited = new Set<string>();
  const queue = [p.game.root];
  while (queue.length) {
    const id = queue.pop()!;
    const n = nodes[id];
    if (
      !n ||
      visited.has(id) ||
      n.id !== id ||
      !Array.isArray(n.children) ||
      !Number.isInteger(n.ply) ||
      typeof n.san !== 'string' ||
      typeof n.uci !== 'string'
    )
      return fail();
    visited.add(id);
    new Chess(n.fen);
    const a = n.annotation;
    if (
      !a ||
      typeof a.comment !== 'string' ||
      !Array.isArray(a.nags) ||
      !a.nags.every((v) => Number.isInteger(v) && v >= 0) ||
      !Array.isArray(a.arrows) ||
      !Array.isArray(a.highlights)
    )
      return fail();
    if (
      a.arrows.some(
        (v) =>
          !v ||
          !/^[GRBY]$/.test(v.color) ||
          !/^[a-h][1-8]$/.test(v.from) ||
          !/^[a-h][1-8]$/.test(v.to),
      ) ||
      a.highlights.some((v) => !v || !/^[GRBY]$/.test(v.color) || !/^[a-h][1-8]$/.test(v.square))
    )
      return fail();
    for (const child of n.children) {
      const c = nodes[child];
      if (!c || c.parent !== id || c.ply !== n.ply + 1) return fail();
      const chess = new Chess(n.fen);
      const move = chess.move({
        from: c.uci.slice(0, 2),
        to: c.uci.slice(2, 4),
        promotion: c.uci[4],
      });
      if (chess.fen() !== c.fen || move.san !== c.san) return fail();
      queue.push(child);
    }
  }
  if (visited.size !== keys.length) return fail();
  for (const [fen, a] of Object.entries(p.analyses)) {
    new Chess(fen);
    if (
      !a ||
      a.fen !== fen ||
      !Number.isFinite(a.cp) ||
      !Number.isFinite(a.depth) ||
      !Number.isFinite(a.nodes) ||
      !Number.isFinite(a.nps) ||
      !Number.isFinite(a.timestamp) ||
      typeof a.complete !== 'boolean' ||
      typeof a.bestMove !== 'string' ||
      !Number.isFinite(a.multiPV) ||
      (a.mate !== undefined && !Number.isFinite(a.mate)) ||
      !Array.isArray(a.lines)
    )
      return fail();
    for (const line of a.lines)
      if (
        !line ||
        !Number.isFinite(line.cp) ||
        !Number.isFinite(line.depth) ||
        !Number.isFinite(line.rank) ||
        !Array.isArray(line.pv) ||
        !Array.isArray(line.san) ||
        !line.pv.every((v) => typeof v === 'string') ||
        !line.san.every((v) => typeof v === 'string') ||
        (line.mate !== undefined && !Number.isFinite(line.mate))
      )
        return fail();
  }
  return p;
}
export function downloadFile(name: string, content: string, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
