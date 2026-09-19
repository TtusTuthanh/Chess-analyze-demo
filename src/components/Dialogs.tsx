import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import {
  X,
  Upload,
  FileText,
  Download,
  Copy,
  Check,
  ArrowUpRight,
  BookOpen,
  ShieldCheck,
  GitBranch,
  Keyboard,
  FolderOpen,
  Activity,
} from 'lucide-react';
import type { Game, Project } from '../types';
import type { Report } from '../lib/analysis';
import { reportMarkdown } from '../lib/analysis';
import { downloadFile } from '../lib/project';
import { exportPgn } from '../lib/pgn';
import { SAMPLE_PGN } from '../lib/sample';
export function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close.current();
      if (e.key === 'Tab') {
        const els = ref.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), textarea, input, select, [tabindex="0"], a[href]',
        );
        if (!els?.length) return;
        if (
          e.shiftKey &&
          (document.activeElement === els[0] || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          els[els.length - 1].focus();
        } else if (
          !e.shiftKey &&
          (document.activeElement === els[els.length - 1] || document.activeElement === ref.current)
        ) {
          e.preventDefault();
          els[0].focus();
        }
      }
    };
    document.addEventListener('keydown', handler);
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = old;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <header>
          <div>
            <h2 id="modal-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
export function PgnImporter({
  onImport,
  onProject,
  onClose,
}: {
  onImport: (text: string) => void;
  onProject: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const load = (value: string) => {
    try {
      onImport(value);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const read = async (f?: File) => {
    if (!f) return;
    if (f.size > 5_000_000) {
      setError('Please choose a file smaller than 5 MB.');
      return;
    }
    try {
      const value = await f.text();
      if (f.name.toLowerCase().endsWith('.json')) onProject(value);
      else {
        setText(value);
        setError('');
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <Modal
      title="Bring your game to life"
      subtitle="Import a PGN and explore the story behind every move."
      onClose={onClose}
    >
      <div className="modal-body">
        <div
          className={`upload-zone ${dragging ? 'dragging' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void read(e.dataTransfer.files[0]);
          }}
        >
          <div className="upload-icon">
            <Upload size={24} />
          </div>
          <strong>Drop your game here</strong>
          <p>PGN game or JSON project · up to 5 MB</p>
          <button className="button outline small" onClick={() => file.current?.click()}>
            <FolderOpen size={15} />
            Browse files
          </button>
          <input
            ref={file}
            type="file"
            accept=".pgn,.json"
            className="sr-only"
            aria-label="Upload PGN or project"
            onChange={(e) => void read(e.target.files?.[0])}
          />
        </div>
        <div className="or-divider">
          <span />
          or paste your PGN
          <span />
        </div>
        <textarea
          className="pgn-input"
          aria-label="PGN text"
          placeholder={
            '[Event "My game"]\n[White "White"]\n[Black "Black"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 *'
          }
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError('');
          }}
        />
        {error && (
          <div className="inline-error" role="alert">
            {error}
          </div>
        )}
        <div className="privacy-message">
          <ShieldCheck size={14} />
          Your games stay on your device. No uploads, no account.
        </div>
      </div>
      <footer>
        <button className="button subtle" onClick={() => load(SAMPLE_PGN)}>
          <BookOpen size={16} />
          Load example game
        </button>
        <button className="button primary" disabled={!text.trim()} onClick={() => load(text)}>
          Import game
          <ArrowUpRight size={16} />
        </button>
      </footer>
    </Modal>
  );
}
export function ExportPanel({
  game,
  project,
  report,
  onClose,
}: {
  game: Game;
  project: Project;
  report: Report;
  onClose: () => void;
}) {
  const pgn = exportPgn(game);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pgn);
      setCopied(true);
    } catch {
      setError('Clipboard unavailable. Select the PGN below and copy it manually.');
    }
  };
  return (
    <Modal
      title="Take your analysis with you"
      subtitle="Your game, annotations, and every alternative line."
      onClose={onClose}
    >
      <div className="modal-body">
        <div className="export-card">
          <div className="export-icon">
            <FileText size={23} />
          </div>
          <div>
            <h3>Annotated PGN</h3>
            <p>Original headers, comments, NAGs, variations & drawings.</p>
          </div>
        </div>
        <textarea
          readOnly
          aria-label="Exported PGN"
          className="pgn-input export-preview"
          value={pgn}
        />
        <div className="export-buttons">
          <button className="button outline" onClick={() => void copy()}>
            {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied!' : 'Copy PGN'}
          </button>
          <button
            className="button primary"
            onClick={() => downloadFile('annotated-game.pgn', pgn, 'application/x-chess-pgn')}
          >
            <Download size={15} />
            Download PGN
          </button>
        </div>
        {error && <div className="inline-error">{error}</div>}
        <div className="export-other">
          <h3>Pick up where you left off</h3>
          <p>Save positions, annotations, engine results, and settings.</p>
          <button
            className="button outline full"
            onClick={() =>
              downloadFile(
                'chess-analysis-project.json',
                JSON.stringify(project, null, 2),
                'application/json',
              )
            }
          >
            <FolderOpen size={16} />
            Save project as JSON
          </button>
        </div>
        <div className="export-other">
          <h3>
            Game report{' '}
            <span className="tiny-badge">{report.complete ? 'COMPLETE' : 'PARTIAL'}</span>
          </h3>
          <p>
            {report.analyzedPlies} of {report.totalPlies} moves analyzed. Accuracy is approximate.
          </p>
          <div className="export-buttons">
            <button
              className="button subtle"
              onClick={() =>
                downloadFile('game-report.md', reportMarkdown(report), 'text/markdown')
              }
            >
              <Download size={14} />
              Markdown
            </button>
            <button
              className="button subtle"
              onClick={() =>
                downloadFile(
                  'game-report.json',
                  JSON.stringify(report, null, 2),
                  'application/json',
                )
              }
            >
              <Download size={14} />
              JSON report
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
export function GameReport({
  report,
  onClose,
  onAnalyze,
  onSelect,
}: {
  report: Report;
  onClose: () => void;
  onAnalyze: () => void;
  onSelect: (id: string) => void;
}) {
  return (
    <Modal title="The story of your game" subtitle={report.title} onClose={onClose} wide>
      <div className="modal-body report-body">
        <div className="report-summary">
          <div>
            <span>RESULT</span>
            <strong>{report.result}</strong>
          </div>
          <div>
            <span>OPENING</span>
            <strong>{report.opening}</strong>
          </div>
          <div>
            <span>MOVES</span>
            <strong>{report.totalMoves}</strong>
          </div>
        </div>
        {!report.complete && (
          <div className="report-notice">
            <InfoIcon />
            <span>
              Partial report · {report.analyzedPlies}/{report.totalPlies} half-moves analyzed.
            </span>
            <button className="text-button" onClick={onAnalyze}>
              Analyze entire game
              <ArrowUpRight size={14} />
            </button>
          </div>
        )}
        <h3>Approximate accuracy</h3>
        <div className="accuracy-cards">
          <div>
            <i className="white-piece" />
            <span>White</span>
            <strong>
              {report.accuracy.white ?? '—'}
              <small>%</small>
            </strong>
          </div>
          <div>
            <i className="black-piece" />
            <span>Black</span>
            <strong>
              {report.accuracy.black ?? '—'}
              <small>%</small>
            </strong>
          </div>
        </div>
        <p className="report-disclaimer">{report.accuracyNote}</p>
        <h3>Critical moments</h3>
        {report.critical.length ? (
          <div className="critical-list">
            {report.critical.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  onSelect(c.id);
                  onClose();
                }}
              >
                <strong>{c.played}</strong>
                <span>{c.classification}</span>
                <span>
                  Best: <b>{c.best}</b>
                </span>
                <span>
                  {c.before} → {c.after}
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
        ) : (
          <div className="report-empty">
            {report.complete
              ? 'No moves crossed the configured error thresholds.'
              : 'Analyze the full game to discover its turning points.'}
          </div>
        )}
        <h3>Phase overview</h3>
        <div className="phase-cards">
          {report.phases.map((p) => (
            <div key={p.phase}>
              <strong>{p.phase}</strong>
              <span>{p.plies} half-moves</span>
              <small>{p.errors} classified errors</small>
            </div>
          ))}
        </div>
        <p className="report-disclaimer">
          Phase boundaries use move count and remaining material. Tactical explanations are not
          invented; critical moments show engine information only.
        </p>
      </div>
      <footer>
        <button
          className="button outline"
          onClick={() => downloadFile('game-report.md', reportMarkdown(report))}
        >
          <Download size={15} />
          Export Markdown
        </button>
        <button className="button primary" onClick={onClose}>
          Back to the board
        </button>
      </footer>
    </Modal>
  );
}
function InfoIcon() {
  return <Activity size={17} />;
}
export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="A little guidance. A better game."
      subtitle="Everything you need to make this workspace your own."
      onClose={onClose}
    >
      <div className="modal-body help-body">
        <h3>
          <Keyboard size={17} />
          Keyboard shortcuts
        </h3>
        <div className="shortcut-list">
          {[
            ['← / →', 'Previous / next move'],
            ['Home / End', 'First / last position'],
            ['Space', 'Play / pause the game'],
            ['Ctrl / ⌘ + Z', 'Undo a saved annotation or variation'],
            ['Ctrl / ⌘ + S', 'Download your project'],
          ].map(([key, text]) => (
            <div key={key}>
              <span>{text}</span>
              <kbd>{key}</kbd>
            </div>
          ))}
        </div>
        <h3>
          <GitBranch size={17} />
          Explore alternatives
        </h3>
        <p>
          Move a piece to add a legal continuation. If the game already has a different move, your
          move becomes a variation. Click any variation to explore it, or paste a continuation in
          the annotation editor.
        </p>
        <h3>Make your mark</h3>
        <p>
          Right-drag to draw an arrow. Right-click to highlight a square. On touchscreens, choose
          the arrow or highlight tool first. Repeat a drawing to remove it. Click Save to keep your
          annotations; Cancel restores the previous version.
        </p>
        <h3>Understand the engine</h3>
        <p>
          All scores are from White’s perspective. Positive favors White. M means a forced mate.
          Whole-game analysis covers the main line; analyze alternative positions individually.
          Click a principal variation to add it to the move tree.
        </p>
        <p>
          Brilliant moves are a manual NAG, not an automatic engine claim. Error thresholds are
          adjustable in engine settings. Opening information comes from PGN headers.
        </p>
        <div className="privacy-message">
          <ShieldCheck size={16} />
          Local-first. Nothing is sent to a server.
        </div>
      </div>
    </Modal>
  );
}
