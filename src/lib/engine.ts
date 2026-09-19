import { Chess } from 'chess.js';
import type { EngineAnalysis, EngineLine, EngineSettings } from '../types';
export class CancelledError extends Error {
  constructor() {
    super('Analysis cancelled');
  }
}
export function uciToSan(fen: string, moves: string[]): string[] {
  const chess = new Chess(fen);
  const san: string[] = [];
  for (const uci of moves) {
    try {
      san.push(chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san);
    } catch {
      break;
    }
  }
  return san;
}
/** One worker and one search at a time. Termination is the cancellation boundary:
 * a late bestmove can never be mistaken for a result from a new position. */
export class StockfishEngine {
  private worker?: Worker;
  private reject?: (reason: Error) => void;
  private timeout?: ReturnType<typeof setTimeout>;
  private ready = false;
  private generation = 0;
  private receive?: (line: string) => void;
  private async initialize() {
    if (this.ready) return;
    await new Promise<void>((resolve, reject) => {
      this.reject = reject;
      try {
        this.worker = new Worker('/engine/stockfish-19-lite-single.js');
        this.timeout = setTimeout(
          () =>
            this.fail(
              new Error(
                'Stockfish did not start. Reload or try a browser with WebAssembly support.',
              ),
            ),
          20_000,
        );
        this.worker.onerror = () =>
          this.fail(
            new Error(
              'Stockfish worker could not load. Check WebAssembly support and local engine files.',
            ),
          );
        this.worker.onmessage = (event: MessageEvent<string>) => {
          const text = String(event.data);
          if (text === 'uciok') this.worker?.postMessage('isready');
          else if (text === 'readyok' && !this.ready) {
            this.ready = true;
            clearTimeout(this.timeout);
            this.reject = undefined;
            resolve();
          } else this.receive?.(text);
        };
        this.worker.postMessage('uci');
      } catch (e) {
        this.fail(e instanceof Error ? e : new Error('Web Worker unavailable.'));
      }
    });
  }
  private fail(error: Error) {
    const reject = this.reject;
    this.reject = undefined;
    this.stop();
    reject?.(error);
  }
  stop() {
    this.generation++;
    clearTimeout(this.timeout);
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = false;
    this.receive = undefined;
    const reject = this.reject;
    this.reject = undefined;
    reject?.(new CancelledError());
  }
  async analyze(
    fen: string,
    settings: EngineSettings,
    onUpdate: (a: EngineAnalysis) => void,
  ): Promise<EngineAnalysis> {
    const generation = this.generation;
    await this.initialize();
    if (generation !== this.generation || !this.worker || !this.ready) throw new CancelledError();
    return new Promise((resolve, reject) => {
      this.reject = reject;
      const sign = fen.split(' ')[1] === 'w' ? 1 : -1;
      const lines = new Map<number, EngineLine>();
      let last: EngineAnalysis = {
        fen,
        depth: 0,
        cp: 0,
        bestMove: '',
        lines: [],
        nodes: 0,
        nps: 0,
        timestamp: Date.now(),
        complete: false,
        multiPV: settings.multiPV,
      };
      this.timeout = setTimeout(
        () => this.fail(new Error('The engine search timed out. Try a lower depth.')),
        120_000,
      );
      this.receive = (text) => {
        if (
          text.startsWith('info ') &&
          text.includes(' pv ') &&
          !/\b(upperbound|lowerbound)\b/.test(text)
        ) {
          const score = text.match(/score (cp|mate) (-?\d+)/);
          const depth = Number(text.match(/\bdepth (\d+)/)?.[1] ?? 0);
          if (!score) return;
          const raw = Number(score[2]);
          const mate = score[1] === 'mate' ? raw * sign : undefined;
          const cp = mate !== undefined ? (raw > 0 ? 1 : -1) * sign * 100000 : raw * sign;
          const pv = text.split(' pv ')[1].trim().split(/\s+/);
          const rank = Number(text.match(/multipv (\d+)/)?.[1] ?? 1);
          lines.set(rank, { rank, cp, mate, depth, pv, san: uciToSan(fen, pv) });
          const first = lines.get(1);
          if (!first) return;
          last = {
            ...last,
            depth: first.depth,
            cp: first.cp,
            mate: first.mate,
            bestMove: first.pv[0] ?? '',
            lines: [...lines.values()].sort((a, b) => a.rank - b.rank),
            nodes: Number(text.match(/\bnodes (\d+)/)?.[1] ?? 0),
            nps: Number(text.match(/\bnps (\d+)/)?.[1] ?? 0),
            timestamp: Date.now(),
          };
          onUpdate(last);
        } else if (text.startsWith('bestmove')) {
          clearTimeout(this.timeout);
          this.reject = undefined;
          this.receive = undefined;
          const chess = new Chess(fen);
          // Terminal nodes may have no PV/info score.
          if (!last.depth && chess.isCheckmate()) {
            last.cp = -sign * 100000;
            last.mate = 0;
          }
          last = {
            ...last,
            bestMove: text.split(' ')[1] === '(none)' ? '' : text.split(' ')[1],
            depth: last.depth || settings.depth,
            complete: true,
          };
          onUpdate(last);
          resolve(last);
        }
      };
      this.worker?.postMessage(`setoption name MultiPV value ${settings.multiPV}`);
      this.worker?.postMessage(`position fen ${fen}`);
      this.worker?.postMessage(`go depth ${settings.depth}`);
    });
  }
}
export function evaluationText(a?: { cp: number; mate?: number }) {
  if (!a) return '—';
  if (a.mate !== undefined) return `${a.cp >= 0 ? '+' : '−'}M${Math.abs(a.mate)}`;
  const val = a.cp / 100;
  return `${val >= 0 ? '+' : '−'}${Math.abs(val).toFixed(2)}`;
}
