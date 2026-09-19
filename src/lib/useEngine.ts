import { useCallback, useEffect, useRef, useState } from 'react';
import type { EngineAnalysis, EngineSettings, Game } from '../types';
import { CancelledError, StockfishEngine } from './engine';
import { mainLine } from './pgn';
export function useEngine(game: Game, current: string, settings: EngineSettings) {
  const engine = useRef(new StockfishEngine());
  const [analyses, setAnalyses] = useState<Record<string, EngineAnalysis>>({});
  const cache = useRef(analyses);
  cache.current = analyses;
  const [live, setLive] = useState(true);
  const [revision, setRevision] = useState(0);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState('');
  const [batch, setBatch] = useState<'idle' | 'running' | 'paused' | 'done'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const generation = useRef(0);
  const store = useCallback((a: EngineAnalysis) => {
    const previous = cache.current[a.fen];
    if (previous?.complete && previous.depth > a.depth && previous.multiPV >= a.multiPV) return;
    cache.current = { ...cache.current, [a.fen]: a };
    setAnalyses(cache.current);
  }, []);
  const stop = useCallback(() => {
    generation.current++;
    engine.current.stop();
    setThinking(false);
    setBatch((b) => (b === 'running' ? 'paused' : b));
  }, []);
  const search = useCallback(
    async (fen: string) => {
      const cached = cache.current[fen];
      if (cached?.complete && cached.depth >= settings.depth && cached.multiPV >= settings.multiPV)
        return cached;
      return engine.current.analyze(fen, settings, store);
    },
    [settings.depth, settings.multiPV, store],
  );
  const analyzeCurrent = useCallback(async () => {
    stop();
    const token = generation.current;
    setThinking(true);
    setError('');
    try {
      await search(game.nodes[current].fen);
      if (token !== generation.current) return;
      const parent = game.nodes[current].parent;
      if (parent) await search(game.nodes[parent].fen);
    } catch (e) {
      if (!(e instanceof CancelledError) && token === generation.current)
        setError((e as Error).message);
    } finally {
      if (token === generation.current) setThinking(false);
    }
  }, [game, current, search, stop]);
  // FEN, not annotations, controls search lifecycle.
  const fen = game.nodes[current].fen;
  const analyzeRef = useRef(analyzeCurrent);
  analyzeRef.current = analyzeCurrent;
  useEffect(() => {
    stop();
    if (live) void analyzeRef.current();
    return () => {
      generation.current++;
      engine.current.stop();
    };
  }, [fen, current, revision, settings.depth, settings.multiPV, live, stop]);
  const analyzeGame = async () => {
    stop();
    setLive(false); // allow the live-effect cleanup to finish before starting the batch
    setError('');
    await new Promise((r) => setTimeout(r, 0));
    setBatch('running');
    const token = generation.current;
    setThinking(true);
    const nodes = [game.nodes[game.root], ...mainLine(game)];
    setProgress({ done: 0, total: nodes.length });
    try {
      for (let i = 0; i < nodes.length; i++) {
        if (generation.current !== token) return;
        await search(nodes[i].fen);
        if (generation.current !== token) return;
        setProgress({ done: i + 1, total: nodes.length });
      }
      setBatch('done');
    } catch (e) {
      if (!(e instanceof CancelledError) && token === generation.current) {
        setError((e as Error).message);
        setBatch('paused');
      }
    } finally {
      if (token === generation.current) setThinking(false);
    }
  };
  const reset = (next: Record<string, EngineAnalysis> = {}) => {
    stop();
    cache.current = next;
    setAnalyses(next);
    setRevision((r) => r + 1);
    setBatch('idle');
    setProgress({ done: 0, total: 0 });
    setError('');
  };
  return {
    analyses,
    setAnalyses,
    reset,
    live,
    setLive,
    thinking,
    error,
    batch,
    progress,
    stop,
    analyzeCurrent,
    analyzeGame,
  };
}
