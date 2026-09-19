import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowLeftRight,
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Compass,
  FileText,
  Focus,
  Keyboard,
  Maximize2,
  MessageSquare,
  Moon,
  MoreHorizontal,
  Pause,
  Play,
  ShieldCheck,
  SkipBack,
  SkipForward,
  Sun,
  X,
} from 'lucide-react';
import type { Annotation, Arrow, DrawingColor, Game, Project, Thresholds } from './types';
import { addVariation, mainLine, parsePgn, pathTo, removeVariation } from './lib/pgn';
import { SAMPLE_PGN } from './lib/sample';
import { assessMove, buildReport, DEFAULT_THRESHOLDS } from './lib/analysis';
import { downloadFile, validateProject } from './lib/project';
import { useEngine } from './lib/useEngine';
import { ChessBoard, type BoardTool } from './components/ChessBoard';
import { MoveList } from './components/MoveList';
import { AnnotationEditor } from './components/AnnotationEditor';
import { AnalysisPanel, MoveComparison } from './components/AnalysisPanel';
import { ExportPanel, GameReport, HelpDialog, PgnImporter } from './components/Dialogs';
const STORAGE_KEY = 'chess-pgn-analyzer-v1';
function initialProject(): Project {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return validateProject(JSON.parse(saved));
  } catch {
    /* Recover with the example if storage is unavailable or invalid. */
  }
  const game = parsePgn(SAMPLE_PGN);
  return {
    version: 1,
    game,
    current: mainLine(game)[11].id,
    analyses: {},
    settings: { depth: 14, multiPV: 1 },
    thresholds: DEFAULT_THRESHOLDS,
  };
}
export default function App() {
  const [initial] = useState(initialProject);
  const [game, setGame] = useState(initial.game);
  const [current, setCurrent] = useState(initial.current);
  const [settings, setSettings] = useState(initial.settings);
  const [thresholds, setThresholds] = useState(initial.thresholds);
  const [draft, setDraft] = useState<Annotation>(structuredClone(game.nodes[current].annotation));
  const [history, setHistory] = useState<Game[]>([]);
  const [modal, setModal] = useState<'import' | 'export' | 'report' | 'help' | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [coordinates, setCoordinates] = useState(true);
  const [showBest, setShowBest] = useState(true);
  const [tool, setTool] = useState<BoardTool>('move');
  const [color, setColor] = useState<DrawingColor>('G');
  const [playing, setPlaying] = useState(false);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('chess-theme') || 'light';
    } catch {
      return 'light';
    }
  });
  const [toast, setToast] = useState('');
  const [saved, setSaved] = useState(false);
  const [mobileTab, setMobileTab] = useState('board');
  const [focus, setFocus] = useState(false);
  const boardRef = useRef<HTMLDivElement>(null);
  const engine = useEngine(game, current, settings);
  useEffect(() => {
    engine.setAnalyses(initial.analyses);
  }, []); // restore a validated cache once
  const node = game.nodes[current];
  const dirty = JSON.stringify(draft) !== JSON.stringify(node.annotation);
  const branch = useMemo(
    () => [...pathTo(game, current), ...mainLine(game, current)],
    [game, current],
  );
  const route = [game.nodes[game.root], ...branch];
  const routeIndex = route.findIndex((n) => n.id === current);
  const analysis = engine.analyses[node.fen];
  const assessment = assessMove(game, node, engine.analyses, thresholds);
  const report = useMemo(
    () => buildReport(game, engine.analyses, thresholds),
    [game, engine.analyses, thresholds],
  );
  const gameWithDraft = useCallback(
    (): Game =>
      dirty
        ? {
            ...game,
            nodes: { ...game.nodes, [current]: { ...node, annotation: structuredClone(draft) } },
          }
        : game,
    [dirty, game, current, node, draft],
  );
  const project = useCallback(
    (): Project => ({
      version: 1,
      game: gameWithDraft(),
      current,
      analyses: Object.fromEntries(Object.entries(engine.analyses).filter(([, a]) => a.complete)),
      settings,
      thresholds,
    }),
    [gameWithDraft, current, engine.analyses, settings, thresholds],
  );
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('chess-theme', theme);
    } catch {
      /* Theme remains available in memory. */
    }
  }, [theme]);
  useEffect(() => {
    setSaved(false);
    const timer = setTimeout(() => {
      try {
        const p = project();
        p.game = game;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
        setSaved(true);
      } catch {
        setSaved(false);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [game, current, settings, thresholds, engine.analyses]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  const commit = (next: Game) => {
    setHistory((h) => [...h.slice(-39), game]);
    setGame(next);
  };
  const saveAnnotation = () => {
    if (dirty) {
      commit(gameWithDraft());
      setToast('Annotation saved.');
    }
  };
  const select = (id: string) => {
    if (!game.nodes[id] || id === current) return;
    const next = gameWithDraft();
    if (dirty) commit(next);
    engine.stop();
    setCurrent(id);
    setDraft(structuredClone(next.nodes[id].annotation));
    setTool('move');
  };
  const navigate = (step: 'first' | 'prev' | 'next' | 'last') => {
    const target =
      step === 'first'
        ? game.root
        : step === 'prev'
          ? node.parent
          : step === 'next'
            ? node.children[0]
            : route.at(-1)?.id;
    if (target) select(target);
  };
  const navigationRef = useRef(navigate);
  navigationRef.current = navigate;
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => navigationRef.current('next'), 1100);
    return () => clearInterval(id);
  }, [playing]);
  useEffect(() => {
    if (!node.children.length) setPlaying(false);
  }, [current, node.children.length]);
  const undo = () => {
    if (dirty) {
      setDraft(structuredClone(node.annotation));
      setToast('Unsaved changes discarded.');
      return;
    }
    const previous = history.at(-1);
    if (!previous) return;
    engine.stop();
    const id = previous.nodes[current] ? current : previous.root;
    setGame(previous);
    setCurrent(id);
    setDraft(structuredClone(previous.nodes[id].annotation));
    setHistory((h) => h.slice(0, -1));
    setToast('Last edit undone.');
  };
  const saveProject = () => {
    downloadFile(
      'chess-analysis-project.json',
      JSON.stringify(project(), null, 2),
      'application/json',
    );
    setToast('Project exported, including current annotations.');
  };
  const handlers = useRef({ navigate, undo, saveProject, modal });
  handlers.current = { navigate, undo, saveProject, modal };
  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      const h = handlers.current;
      const editable = (e.target as HTMLElement).closest(
        'input,textarea,select,[contenteditable="true"]',
      );
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        h.saveProject();
        return;
      }
      if (editable || h.modal) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        h.undo();
        return;
      }
      const map: Record<string, 'first' | 'prev' | 'next' | 'last'> = {
        ArrowLeft: 'prev',
        ArrowRight: 'next',
        Home: 'first',
        End: 'last',
      };
      if (map[e.key]) {
        e.preventDefault();
        setPlaying(false);
        h.navigate(map[e.key]);
      }
      if (e.code === 'Space') {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    };
    document.addEventListener('keydown', keyboard);
    return () => document.removeEventListener('keydown', keyboard);
  }, []);
  const variation = (text: string) => {
    try {
      const result = addVariation(gameWithDraft(), current, text);
      commit(result.game);
      engine.stop();
      setCurrent(result.last);
      setDraft(structuredClone(result.game.nodes[result.last].annotation));
      setToast('Continuation added to the move tree.');
      setTool('move');
      return true;
    } catch (e) {
      setToast((e as Error).message);
      return false;
    }
  };
  const drawArrow = (arrow: Arrow) =>
    setDraft((a) => ({
      ...a,
      arrows: a.arrows.some(
        (v) => v.from === arrow.from && v.to === arrow.to && v.color === arrow.color,
      )
        ? a.arrows.filter(
            (v) => !(v.from === arrow.from && v.to === arrow.to && v.color === arrow.color),
          )
        : [...a.arrows, arrow],
    }));
  const highlight = (square: string, c: DrawingColor) =>
    setDraft((a) => ({
      ...a,
      highlights: a.highlights.some((v) => v.square === square && v.color === c)
        ? a.highlights.filter((v) => v.square !== square)
        : [...a.highlights.filter((v) => v.square !== square), { square, color: c }],
    }));
  const loadGame = (text: string) => {
    const next = parsePgn(text);
    engine.reset();
    setGame(next);
    setCurrent(next.root);
    setDraft(structuredClone(next.nodes[next.root].annotation));
    setHistory([]);
    setPlaying(false);
    setModal(null);
    engine.setLive(true);
    setToast('Game imported. Your analysis starts here.');
  };
  const loadProject = (text: string) => {
    const p = validateProject(JSON.parse(text));
    engine.reset(p.analyses);
    setGame(p.game);
    setCurrent(p.current);
    setDraft(structuredClone(p.game.nodes[p.current].annotation));
    setSettings(p.settings);
    setThresholds(p.thresholds);
    setHistory([]);
    setPlaying(false);
    setModal(null);
    setToast('Project restored with annotations and engine results.');
  };
  const setValidThresholds = (next: Thresholds) => {
    if (next.inaccuracy < next.mistake && next.mistake < next.blunder) setThresholds(next);
    else setToast('Thresholds must increase: inaccuracy < mistake < blunder.');
  };
  const openModal = (m: typeof modal) => {
    saveAnnotation();
    setPlaying(false);
    setModal(m);
  };
  const blackName = game.headers.Black ?? 'Black';
  const whiteName = game.headers.White ?? 'White';
  const player = (side: 'w' | 'b') => (
    <div className="player">
      <div className={`player-avatar ${side === 'w' ? 'white-avatar' : ''}`}>
        <img src={`/pieces/${side}K.svg`} alt="" />
      </div>
      <div>
        <strong>{side === 'w' ? whiteName : blackName}</strong>
        <span>
          {side === 'w' ? 'White pieces' : 'Black pieces'}
          {game.headers[side === 'w' ? 'WhiteElo' : 'BlackElo'] &&
            ` · ${game.headers[side === 'w' ? 'WhiteElo' : 'BlackElo']}`}
        </span>
      </div>
      <span className={`player-side ${node.fen.split(' ')[1] === side ? 'to-move' : ''}`}>
        {node.fen.split(' ')[1] === side ? (
          <>
            <i />
            To move
          </>
        ) : side === 'w' ? (
          'WHITE'
        ) : (
          'BLACK'
        )}
      </span>
    </div>
  );
  return (
    <div className={`app ${focus ? 'focus-mode' : ''}`}>
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setModal(null);
          }}
        >
          <span className="brand-mark">♞</span>
          <span>
            Chess<span className="brand-secondary">PGN Analyzer</span>
          </span>
          <span className="beta-label">BETA</span>
        </a>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className="active"
            onClick={() => {
              setModal(null);
              setFocus(false);
            }}
          >
            <Compass size={16} />
            Workspace
          </button>
          <button onClick={() => openModal('report')}>
            <FileText size={16} />
            Game report
          </button>
        </nav>
        <div className="topbar-right">
          <span className="local-first">
            <ShieldCheck size={14} />
            Local-first & private
          </span>
          <span className="nav-divider" />
          <button
            className="icon-button"
            title="Toggle dark mode"
            aria-label="Toggle dark mode"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            className="icon-button"
            title="Help & shortcuts"
            aria-label="Help & shortcuts"
            onClick={() => setModal('help')}
          >
            <CircleHelp size={19} />
          </button>
        </div>
      </header>
      <main className="workspace">
        <section className="workspace-heading">
          <div>
            <div className="eyebrow">YOUR ANALYSIS WORKSPACE</div>
            <h1>
              Every move tells a story<span>.</span>
            </h1>
            <p>Go beyond the moves. Find the ideas that make you a better player.</p>
          </div>
          <div className="heading-actions">
            <button className="button outline" onClick={() => openModal('import')}>
              <ArrowUpFromLine size={16} />
              Import PGN
            </button>
            <button className="button primary" onClick={() => openModal('export')}>
              <ArrowDownToLine size={16} />
              Export game
              <ChevronDown size={14} />
            </button>
          </div>
        </section>
        <div className="game-banner">
          <div className="game-banner-icon">
            <BookOpen size={19} />
          </div>
          <div className="game-title">
            <strong>{game.headers.Event ?? 'Untitled game'}</strong>
            <span>
              {game.headers.Site ?? 'Unknown location'}
              <i /> {game.headers.Date?.replace(/\./g, '/') ?? 'Unknown date'}
            </span>
          </div>
          <span className="result-pill">{game.headers.Result}</span>
          <div className="opening-info">
            <span className="eco-label">{game.headers.ECO ?? 'PGN'}</span>
            <span>{game.headers.Opening ?? 'Opening not specified'}</span>
          </div>
          <button
            className="icon-button"
            title="View game information"
            aria-label="View game information"
            onClick={() => setModal('report')}
          >
            <MoreHorizontal size={19} />
          </button>
        </div>
        <div className="mobile-tabs">
          {['board', 'moves', 'analysis'].map((t) => (
            <button
              key={t}
              className={mobileTab === t ? 'active' : ''}
              onClick={() => setMobileTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
        <div className={`analysis-grid mobile-${mobileTab}`}>
          <div className="board-column" ref={boardRef}>
            <div className="board-topline">
              {player(flipped ? 'w' : 'b')}
              <div className="board-view-tools">
                <button
                  className={`icon-button ${coordinates ? 'enabled' : ''}`}
                  title="Toggle coordinates"
                  aria-label="Toggle coordinates"
                  onClick={() => setCoordinates((v) => !v)}
                >
                  <span className="coordinates-icon">a1</span>
                </button>
                <button
                  className="icon-button"
                  title="Focus board"
                  aria-label="Focus board"
                  onClick={() => setFocus((v) => !v)}
                >
                  {focus ? <X size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>
            </div>
            <ChessBoard
              node={node}
              annotation={draft}
              analysis={analysis}
              flipped={flipped}
              coordinates={coordinates}
              showBest={showBest}
              tool={tool}
              color={color}
              onMove={variation}
              onArrow={drawArrow}
              onHighlight={highlight}
            />
            <div className="board-bottomline">
              {player(flipped ? 'b' : 'w')}
              <button
                className="icon-button"
                title="Flip board"
                aria-label="Flip board"
                onClick={() => setFlipped((v) => !v)}
              >
                <ArrowLeftRight size={18} />
              </button>
            </div>
            <div className="board-navigation">
              <button
                className="icon-button"
                title="Starting position (Home)"
                aria-label="First move"
                disabled={!node.parent}
                onClick={() => {
                  setPlaying(false);
                  navigate('first');
                }}
              >
                <SkipBack size={19} />
              </button>
              <button
                className="icon-button"
                title="Previous move (←)"
                aria-label="Previous move"
                disabled={!node.parent}
                onClick={() => {
                  setPlaying(false);
                  navigate('prev');
                }}
              >
                <ChevronLeft size={22} />
              </button>
              <button
                className="play-button"
                title="Play / pause (Space)"
                aria-label={playing ? 'Pause game' : 'Play game'}
                disabled={!node.children.length && !playing}
                onClick={() => setPlaying((v) => !v)}
              >
                {playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
              </button>
              <button
                className="icon-button"
                title="Next move (→)"
                aria-label="Next move"
                disabled={!node.children.length}
                onClick={() => {
                  setPlaying(false);
                  navigate('next');
                }}
              >
                <ChevronRight size={22} />
              </button>
              <button
                className="icon-button"
                title="Last position (End)"
                aria-label="Last move"
                disabled={!node.children.length}
                onClick={() => {
                  setPlaying(false);
                  navigate('last');
                }}
              >
                <SkipForward size={19} />
              </button>
              <div className="navigation-separator" />
              <span className="move-counter">
                {routeIndex}
                <span> / {route.length - 1}</span>
              </span>
            </div>
            <input
              className="timeline"
              aria-label="Move timeline"
              type="range"
              min="0"
              max={route.length - 1}
              value={routeIndex}
              onChange={(e) => {
                setPlaying(false);
                select(route[Number(e.target.value)].id);
              }}
            />
            <div className="board-toolbar">
              <button className={showBest ? 'active' : ''} onClick={() => setShowBest((v) => !v)}>
                <Focus size={14} />
                <span>Best move</span>
                <span className={`mini-toggle ${showBest ? 'on' : ''}`} />
              </button>
              <span>Right-click to draw on the board</span>
              <button
                className="icon-button"
                title="Board shortcuts"
                aria-label="Board shortcuts"
                onClick={() => setModal('help')}
              >
                <Keyboard size={15} />
              </button>
            </div>
            <MoveComparison node={node} assessment={assessment} />
          </div>
          <div className="moves-column">
            <MoveList
              game={game}
              current={current}
              onSelect={(id) => {
                setPlaying(false);
                select(id);
              }}
              analyses={engine.analyses}
              thresholds={thresholds}
              onDeleteVariation={(id) => {
                try {
                  const next = removeVariation(gameWithDraft(), id);
                  commit(next);
                  const target = next.nodes[current] ? current : next.root;
                  setCurrent(target);
                  setDraft(structuredClone(next.nodes[target].annotation));
                  setToast('Variation removed. Use Ctrl+Z to undo.');
                } catch (e) {
                  setToast((e as Error).message);
                }
              }}
            />
            <AnnotationEditor
              key={current}
              node={node}
              draft={draft}
              onDraft={setDraft}
              onSave={saveAnnotation}
              onCancel={() => {
                setDraft(structuredClone(node.annotation));
                setTool('move');
              }}
              onVariation={variation}
              tool={tool}
              setTool={setTool}
              color={color}
              setColor={setColor}
              dirty={dirty}
              onUndo={undo}
              canUndo={history.length > 0 || dirty}
            />
          </div>
          <div className="engine-column">
            <AnalysisPanel
              node={node}
              analysis={analysis}
              assessment={assessment}
              settings={settings}
              onSettings={setSettings}
              live={engine.live}
              thinking={engine.thinking}
              error={engine.error}
              onToggle={() => {
                if (engine.live || engine.thinking) {
                  engine.setLive(false);
                  engine.stop();
                } else engine.setLive(true);
              }}
              onCurrent={() => void engine.analyzeCurrent()}
              onEntire={() => {
                setPlaying(false);
                void engine.analyzeGame();
              }}
              onStop={engine.stop}
              batch={engine.batch}
              progress={engine.progress}
              onReport={() => openModal('report')}
              onPlayLine={variation}
              thresholds={thresholds}
              onThresholds={setValidThresholds}
            />
            <div className="study-note">
              <div>
                <BookOpen size={17} />
                <strong>A space to think deeper.</strong>
              </div>
              <p>Explore a line. Leave a note. Turn one game into a lesson worth keeping.</p>
              <button onClick={() => setModal('help')}>
                Make the most of your workspace
                <ArrowUpFromLine size={13} />
              </button>
            </div>
          </div>
        </div>
        <footer className="workspace-footer">
          <span>
            <span className={`save-dot ${saved ? 'saved' : ''}`} />
            {dirty
              ? 'Annotation draft · click Save to keep'
              : saved
                ? 'Saved on this device'
                : 'Saving locally…'}
          </span>
          <span>
            <Keyboard size={13} />
            <kbd>←</kbd>
            <kbd>→</kbd> navigate <span className="footer-dot">·</span>
            <kbd>space</kbd> play / pause
          </span>
          <button onClick={saveProject}>
            <ArrowDownToLine size={13} />
            Save project
          </button>
        </footer>
      </main>
      {modal === 'import' && (
        <PgnImporter onImport={loadGame} onProject={loadProject} onClose={() => setModal(null)} />
      )}
      {modal === 'export' && (
        <ExportPanel
          game={gameWithDraft()}
          project={project()}
          report={report}
          onClose={() => setModal(null)}
        />
      )}
      {modal === 'report' && (
        <GameReport
          report={report}
          onClose={() => setModal(null)}
          onAnalyze={() => {
            setModal(null);
            void engine.analyzeGame();
          }}
          onSelect={select}
        />
      )}
      {modal === 'help' && <HelpDialog onClose={() => setModal(null)} />}
      {toast && (
        <div className="toast" role="status">
          <MessageSquare size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast('')} aria-label="Dismiss notification">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
