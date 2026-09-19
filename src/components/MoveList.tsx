import { useEffect, useRef, useState } from 'react';
import { GitBranch, MessageSquare, List, ChevronDown, Trash2 } from 'lucide-react';
import type { EngineAnalysis, Game, MoveNode, Thresholds } from '../types';
import { mainLine, moveLabel, NAGS } from '../lib/pgn';
import { assessMove } from '../lib/analysis';
export const classSymbols: Record<string, string> = {
  'Best move': '★',
  Good: '✓',
  Inaccuracy: '?!',
  Mistake: '?',
  Blunder: '??',
  'Missed win': '↗',
};
export function className(label: string) {
  return label.toLowerCase().replace(/ /g, '-');
}
interface Props {
  game: Game;
  current: string;
  onSelect: (id: string) => void;
  analyses: Record<string, EngineAnalysis>;
  thresholds: Thresholds;
  onDeleteVariation: (id: string) => void;
}
export function MoveList({
  game,
  current,
  onSelect,
  analyses,
  thresholds,
  onDeleteVariation,
}: Props) {
  const [tab, setTab] = useState<'moves' | 'details'>('moves');
  const [showComments, setShowComments] = useState(true);
  const container = useRef<HTMLDivElement>(null);
  const line = mainLine(game);
  useEffect(() => {
    const active = container.current?.querySelector('[aria-current="step"]');
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [current]);
  const moveButton = (node: MoveNode, variation = false) => {
    const a = assessMove(game, node, analyses, thresholds);
    return (
      <button
        key={node.id}
        aria-current={current === node.id ? 'step' : undefined}
        className={`move-button ${current === node.id ? 'active' : ''} ${variation ? 'variation-move' : ''}`}
        onClick={() => onSelect(node.id)}
        title={
          a
            ? `${a.label}${a.loss === null ? ' · mate transition' : ` · ${a.loss.toFixed(2)} pawn loss`}`
            : moveLabel(node)
        }
      >
        <span>
          {variation ? moveLabel(node) : node.san}
          <span className="nag">
            {node.annotation.nags.map((n) => NAGS[n] ?? `$${n}`).join('')}
          </span>
        </span>
        {a ? (
          <span className={`move-mark ${className(a.label)}`} aria-label={a.label}>
            {classSymbols[a.label]}
          </span>
        ) : node.annotation.comment ? (
          <MessageSquare size={12} className="comment-indicator" />
        ) : null}
      </button>
    );
  };
  const variations = (parent: MoveNode, depth = 0): React.ReactNode =>
    parent.children.slice(1).map((id) => {
      const first = game.nodes[id];
      const nodes = [first, ...mainLine(game, id)];
      return (
        <div className="variation-line" key={id} style={{ marginLeft: Math.min(depth, 4) * 5 }}>
          <div className="variation-heading">
            <GitBranch size={12} />
            <span>Alternative line</span>
            <button
              title="Delete variation"
              aria-label="Delete variation"
              onClick={() => onDeleteVariation(id)}
            >
              <Trash2 size={12} />
            </button>
          </div>
          {nodes.map((n) => (
            <span key={n.id}>
              {moveButton(n, true)}
              {showComments && n.annotation.comment && (
                <span className="variation-comment">{n.annotation.comment}</span>
              )}
            </span>
          ))}
          {nodes.map((n) => (
            <div key={n.id}>{variations(n, depth + 1)}</div>
          ))}
        </div>
      );
    });
  const rows: MoveNode[][] = [];
  for (const node of line) {
    const last = rows.at(-1);
    if (last && Math.ceil(last[0].ply / 2) === Math.ceil(node.ply / 2)) last.push(node);
    else rows.push([node]);
  }
  return (
    <section className="panel moves-panel">
      <div className="panel-tabs">
        <button className={tab === 'moves' ? 'active' : ''} onClick={() => setTab('moves')}>
          <List size={16} />
          Moves <span className="count-badge">{line.length}</span>
        </button>
        <button className={tab === 'details' ? 'active' : ''} onClick={() => setTab('details')}>
          Game info
        </button>
      </div>
      {tab === 'details' ? (
        <div className="game-details">
          {Object.entries(game.headers).map(([k, v]) => (
            <div key={k}>
              <span>{k}</span>
              <strong>{v}</strong>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="moves-subhead">
            <span>MAIN LINE</span>
            <button onClick={() => setShowComments((v) => !v)} title="Toggle comments">
              <MessageSquare size={13} />
              {showComments ? 'Comments' : 'Hidden'}
              <ChevronDown size={12} />
            </button>
          </div>
          <div className="moves-scroll" ref={container}>
            {game.nodes[game.root].annotation.comment && (
              <p className="move-comment">{game.nodes[game.root].annotation.comment}</p>
            )}
            {rows.map((row, i) => (
              <div className="move-row-group" key={i}>
                <div
                  className={`move-row ${row.some((n) => n.id === current) ? 'selected-row' : ''}`}
                >
                  <span className="move-number">{Math.ceil(row[0].ply / 2)}.</span>
                  {row[0].ply % 2 === 0 && <span />}
                  {row.map((n) => moveButton(n))}
                </div>
                {row.map((n) => (
                  <div key={n.id}>
                    {showComments && n.annotation.comment && (
                      <div className={`move-comment ${current === n.id ? 'current-comment' : ''}`}>
                        <MessageSquare size={12} />
                        <span>{n.annotation.comment}</span>
                      </div>
                    )}
                    {n.parent && variations(game.nodes[n.parent])}
                  </div>
                ))}
              </div>
            ))}
            <div className="game-result">
              <span>{game.headers.Result}</span>
              <small>
                {game.headers.Result === '1-0'
                  ? 'White wins'
                  : game.headers.Result === '0-1'
                    ? 'Black wins'
                    : game.headers.Result === '1/2-1/2'
                      ? 'Draw'
                      : 'Game in progress'}
              </small>
            </div>
          </div>
          <div className="move-legend">
            <span>
              <i className="legend-dot inaccuracy" />
              Inaccuracy
            </span>
            <span>
              <i className="legend-dot mistake" />
              Mistake
            </span>
            <span>
              <i className="legend-dot blunder" />
              Blunder
            </span>
          </div>
        </>
      )}
    </section>
  );
}
