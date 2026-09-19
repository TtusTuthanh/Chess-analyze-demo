import {
  Activity,
  ChevronDown,
  Cpu,
  Play,
  Square,
  Minus,
  Plus,
  Layers,
  Pause,
  ArrowUpRight,
  Info,
  SlidersHorizontal,
} from 'lucide-react';
import { useState } from 'react';
import type {
  EngineAnalysis,
  EngineSettings,
  MoveAssessment,
  MoveNode,
  Thresholds,
} from '../types';
import { evaluationText } from '../lib/engine';
import { className, classSymbols } from './MoveList';
interface Props {
  node: MoveNode;
  analysis?: EngineAnalysis;
  assessment?: MoveAssessment;
  settings: EngineSettings;
  onSettings: (settings: EngineSettings) => void;
  live: boolean;
  thinking: boolean;
  error: string;
  onToggle: () => void;
  onCurrent: () => void;
  onEntire: () => void;
  onStop: () => void;
  batch: string;
  progress: { done: number; total: number };
  onReport: () => void;
  onPlayLine: (line: string) => void;
  thresholds: Thresholds;
  onThresholds: (t: Thresholds) => void;
}
export function AnalysisPanel(p: Props) {
  const [showSettings, setShowSettings] = useState(false);
  const a = p.analysis;
  const best = a?.lines[0]?.san[0];
  const white = p.node.fen.split(' ')[1] === 'w';
  return (
    <section className="panel analysis-panel">
      <div className="panel-title">
        <span>
          <Activity size={18} />
          Analysis
        </span>
        <span className={`engine-status ${p.thinking ? 'thinking' : ''}`}>
          <i />
          {p.thinking ? 'Thinking' : p.error ? 'Offline' : 'Ready'}
        </span>
      </div>
      <div className="analysis-body">
        <div className="engine-name">
          <div className="engine-icon">
            <Cpu size={19} />
          </div>
          <div>
            <strong>
              Stockfish 19 <span className="tiny-badge">WASM</span>
            </strong>
            <small>Runs privately in your browser</small>
          </div>
          <button
            className="icon-button"
            aria-label="Engine settings"
            title="Engine settings"
            onClick={() => setShowSettings((v) => !v)}
          >
            <SlidersHorizontal size={15} />
          </button>
        </div>
        <div className="evaluation-card">
          <div>
            <span className="field-caption">POSITION EVALUATION</span>
            <span className="side-to-move">
              <i className={white ? 'white-piece' : 'black-piece'} />
              {white ? 'White' : 'Black'} to move
            </span>
          </div>
          <div className="evaluation-score">
            <strong>{evaluationText(a)}</strong>
            <span>
              {!a
                ? 'Ready to explore'
                : a.mate !== undefined
                  ? a.mate === 0
                    ? 'Checkmate'
                    : `${a.cp > 0 ? 'White' : 'Black'} has forced mate`
                  : Math.abs(a.cp) < 30
                    ? 'An equal position'
                    : `${a.cp > 0 ? 'White' : 'Black'} is better`}
            </span>
          </div>
          <div className="horizontal-eval">
            <div
              style={{
                width: `${a ? Math.max(4, Math.min(96, 50 + 45 * Math.tanh(a.cp / 500))) : 50}%`,
              }}
            />
          </div>
          <div className="eval-labels">
            <span>WHITE</span>
            <span>BLACK</span>
          </div>
        </div>
        <div className="engine-stats">
          <div>
            <span>Depth</span>
            <strong>
              {a?.depth ?? '—'}
              <small> / {p.settings.depth}</small>
            </strong>
          </div>
          <div>
            <span>Nodes</span>
            <strong>
              {a
                ? Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
                    a.nodes,
                  )
                : '—'}
            </strong>
          </div>
          <div>
            <span>Nodes / sec</span>
            <strong>
              {a
                ? Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(
                    a.nps,
                  )
                : '—'}
            </strong>
          </div>
        </div>
        <div className="best-move">
          <span>
            <ArrowUpRight size={15} />
            Best continuation
          </span>
          <strong>
            {best ?? (a?.mate === 0 ? 'Checkmate' : '—')}{' '}
            {best && <span className="best-star">★</span>}
          </strong>
        </div>
        <div className="pv-lines">
          {a?.lines.length ? (
            a.lines.map((line) => (
              <button
                key={line.rank}
                className="pv-line"
                onClick={() => p.onPlayLine(line.pv.slice(0, 10).join(' '))}
                title="Add this engine line as a variation"
              >
                <span className="pv-eval">{evaluationText(line)}</span>
                <span>{line.san.slice(0, 8).join(' ')}</span>
                <ChevronDown size={12} />
              </button>
            ))
          ) : (
            <div className="pv-empty">Start analysis to discover the best line.</div>
          )}
        </div>
        <div className="engine-options">
          <label>
            Depth
            <div className="stepper">
              <button
                aria-label="Decrease depth"
                disabled={p.settings.depth <= 8}
                onClick={() => p.onSettings({ ...p.settings, depth: p.settings.depth - 1 })}
              >
                <Minus size={13} />
              </button>
              <span>{p.settings.depth}</span>
              <button
                aria-label="Increase depth"
                disabled={p.settings.depth >= 22}
                onClick={() => p.onSettings({ ...p.settings, depth: p.settings.depth + 1 })}
              >
                <Plus size={13} />
              </button>
            </div>
          </label>
          <label>
            MultiPV
            <select
              aria-label="MultiPV"
              value={p.settings.multiPV}
              onChange={(e) => p.onSettings({ ...p.settings, multiPV: Number(e.target.value) })}
            >
              {[1, 2, 3, 5].map((n) => (
                <option value={n} key={n}>
                  {n} {n === 1 ? 'line' : 'lines'}
                </option>
              ))}
            </select>
          </label>
        </div>
        {showSettings && (
          <div className="threshold-settings">
            <strong>Classification thresholds</strong>
            <p>Pawn loss, adjusted for the moving side. Mate transitions are handled separately.</p>
            {(['inaccuracy', 'mistake', 'blunder'] as const).map((k) => (
              <label key={k}>
                {k}
                <input
                  type="number"
                  min="0.05"
                  max="20"
                  step="0.05"
                  value={p.thresholds[k]}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (Number.isFinite(v) && v > 0) p.onThresholds({ ...p.thresholds, [k]: v });
                  }}
                />
              </label>
            ))}
          </div>
        )}
        {p.error && (
          <div className="inline-error" role="alert">
            {p.error}
          </div>
        )}
        <button
          className={`button full ${p.live || p.thinking ? 'subtle' : 'primary'}`}
          onClick={p.onToggle}
        >
          {p.live || p.thinking ? <Square size={14} /> : <Play size={14} />}{' '}
          {p.live || p.thinking ? 'Stop analysis' : 'Start analysis'}
        </button>
        <button
          className="text-button current-analysis"
          onClick={p.onCurrent}
          disabled={p.thinking}
        >
          Analyze current position
        </button>
        <div className="whole-game-section">
          <div>
            <Layers size={16} />
            <strong>See the whole picture</strong>
          </div>
          <p>Find turning points, missed chances, and your best moves.</p>
          <button
            className="button outline full"
            onClick={p.batch === 'running' ? p.onStop : p.onEntire}
          >
            {p.batch === 'running' ? <Pause size={15} /> : <Activity size={15} />}{' '}
            {p.batch === 'running'
              ? 'Pause game analysis'
              : p.batch === 'paused'
                ? 'Resume game analysis'
                : 'Analyze entire game'}
          </button>
          {p.progress.total > 0 && (
            <>
              <progress max={p.progress.total} value={p.progress.done} />
              <small className="progress-caption">
                {p.progress.done} / {p.progress.total} positions · {p.batch}
              </small>
            </>
          )}
          {p.batch === 'done' && (
            <button className="text-button" onClick={p.onReport}>
              View game report <ArrowUpRight size={13} />
            </button>
          )}
        </div>
        <div className="engine-note">
          <Info size={13} />
          <span>Evaluations are from White’s perspective.</span>
        </div>
      </div>
    </section>
  );
}
export function MoveComparison({
  node,
  assessment,
}: {
  node: MoveNode;
  assessment?: MoveAssessment;
}) {
  return (
    <section className="panel comparison-panel">
      <div className="comparison-heading">
        <span>MOVE INSIGHT</span>
        {assessment ? (
          <span className={`classification ${className(assessment.label)}`}>
            {classSymbols[assessment.label]} {assessment.label}
          </span>
        ) : (
          <span className="muted">{node.parent ? 'Analyze to compare' : 'Starting position'}</span>
        )}
      </div>
      <div className="comparison-grid">
        <div>
          <span>Played</span>
          <strong>{node.san || '—'}</strong>
          <small>{evaluationText(assessment?.after)}</small>
        </div>
        <div>
          <span>Engine’s choice</span>
          <strong>{assessment?.best ?? '—'}</strong>
          <small>{evaluationText(assessment?.before)}</small>
        </div>
        <div>
          <span>Evaluation loss</span>
          <strong>
            {assessment
              ? assessment.loss === null
                ? 'Mate'
                : `−${assessment.loss.toFixed(2)}`
              : '—'}
          </strong>
          <small>{assessment?.loss === null ? 'transition' : 'pawns'}</small>
        </div>
      </div>
    </section>
  );
}
