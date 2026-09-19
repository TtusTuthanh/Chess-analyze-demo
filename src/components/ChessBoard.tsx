import { useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import type { Annotation, Arrow, DrawingColor, EngineAnalysis, MoveNode } from '../types';
import { evaluationText } from '../lib/engine';
export type BoardTool = 'move' | 'arrow' | 'highlight';
export const drawingColors: Record<DrawingColor, string> = {
  G: '#318660',
  R: '#d96360',
  B: '#538dcc',
  Y: '#d5a83c',
};
interface Props {
  node: MoveNode;
  annotation: Annotation;
  analysis?: EngineAnalysis;
  flipped: boolean;
  coordinates: boolean;
  showBest: boolean;
  tool: BoardTool;
  color: DrawingColor;
  onMove: (uci: string) => void;
  onArrow: (arrow: Arrow) => void;
  onHighlight: (square: string, color: DrawingColor) => void;
}
export function ChessBoard({
  node,
  annotation,
  analysis,
  flipped,
  coordinates,
  showBest,
  tool,
  color,
  onMove,
  onArrow,
  onHighlight,
}: Props) {
  const chess = useMemo(() => new Chess(node.fen), [node.fen]);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectionFen, setSelectionFen] = useState(node.fen);
  const [promotion, setPromotion] = useState<string | null>(null);
  const start = useRef<{ square: string; draw: boolean } | null>(null);
  if (selectionFen !== node.fen) {
    setSelectionFen(node.fen);
    setSelected(null);
    setPromotion(null);
  }
  const files = flipped ? 'hgfedcba' : 'abcdefgh';
  const ranks = flipped ? '12345678' : '87654321';
  const squares = [...ranks].flatMap((r) => [...files].map((f) => f + r));
  const legal = selected
    ? chess.moves({ square: selected as Square, verbose: true }).map((m) => m.to)
    : [];
  const position = (s: string) => ({
    x: files.indexOf(s[0]) * 100 + 50,
    y: ranks.indexOf(s[1]) * 100 + 50,
  });
  const arrows = [...annotation.arrows];
  if (showBest && analysis?.bestMove && analysis.bestMove !== '0000')
    arrows.unshift({
      from: analysis.bestMove.slice(0, 2),
      to: analysis.bestMove.slice(2, 4),
      color: 'G',
    });
  const tryMove = (from: string, to: string) => {
    const moves = chess.moves({ square: from as Square, verbose: true }).filter((m) => m.to === to);
    if (moves.length) {
      if (moves.some((m) => m.promotion)) setPromotion(from + to);
      else onMove(from + to);
      setSelected(null);
    } else setSelected(chess.get(to as Square)?.color === chess.turn() ? to : null);
  };
  const clickSquare = (square: string) => {
    if (tool === 'highlight') {
      onHighlight(square, color);
      return;
    }
    if (selected && selected !== square) {
      if (tool === 'arrow') {
        onArrow({ from: selected, to: square, color });
        setSelected(null);
      } else tryMove(selected, square);
    } else setSelected(square === selected ? null : square);
  };
  const percent = analysis ? Math.max(4, Math.min(96, 50 + 45 * Math.tanh(analysis.cp / 500))) : 50;
  return (
    <div className="board-with-eval">
      <div
        className="vertical-eval"
        aria-label={`Evaluation ${evaluationText(analysis)}, White perspective`}
      >
        <div className="eval-white" style={{ height: `${percent}%` }} />
        <span className={analysis && analysis.cp < 0 ? 'negative' : ''}>
          {analysis?.mate !== undefined
            ? `M${Math.abs(analysis.mate)}`
            : analysis
              ? Math.abs(analysis.cp / 100).toFixed(1)
              : '–'}
        </span>
      </div>
      <div
        className={`chessboard tool-${tool}`}
        role="group"
        aria-label="Interactive chessboard"
        onContextMenu={(e) => e.preventDefault()}
      >
        {squares.map((square, index) => {
          const piece = chess.get(square as Square);
          const light = (Math.floor(index / 8) + (index % 8)) % 2 === 0;
          const highlight = annotation.highlights.find((h) => h.square === square);
          const last = node.uci.slice(0, 2) === square || node.uci.slice(2, 4) === square;
          const check = piece?.type === 'k' && piece.color === chess.turn() && chess.isCheck();
          return (
            <button
              key={square}
              data-square={square}
              aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${{ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }[piece.type]}` : ''}`}
              className={`square ${light ? 'light' : 'dark'} ${last ? 'last-move' : ''} ${selected === square ? 'selected' : ''} ${check ? 'check' : ''}`}
              onPointerDown={(e) => {
                e.preventDefault();
                start.current = { square, draw: e.button === 2 || tool === 'arrow' };
              }}
              onPointerUp={(e) => {
                const first = start.current;
                start.current = null;
                if (!first) return;
                const end = (
                  document
                    .elementFromPoint(e.clientX, e.clientY)
                    ?.closest('[data-square]') as HTMLElement | null
                )?.dataset.square;
                if (!end) return;
                if (first.draw) {
                  if (first.square !== end) {
                    onArrow({ from: first.square, to: end, color });
                    setSelected(null);
                  } else if (e.button === 2) onHighlight(end, color);
                  else clickSquare(end);
                } else if (tool === 'highlight') onHighlight(end, color);
                else if (first.square !== end) tryMove(first.square, end);
                else clickSquare(end);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') clickSquare(square);
              }}
            >
              {highlight && (
                <span
                  className="square-highlight"
                  style={{ background: drawingColors[highlight.color] }}
                />
              )}
              {coordinates && index % 8 === 0 && <span className="rank-label">{square[1]}</span>}
              {coordinates && index >= 56 && <span className="file-label">{square[0]}</span>}
              {piece && (
                <img
                  draggable={false}
                  src={`/pieces/${piece.color}${piece.type.toUpperCase()}.svg`}
                  alt=""
                />
              )}
              {legal.includes(square as Square) && tool === 'move' && (
                <span className={piece ? 'legal-capture' : 'legal-dot'} />
              )}
            </button>
          );
        })}
        <svg className="board-arrows" viewBox="0 0 800 800" aria-hidden="true">
          <defs>
            {Object.entries(drawingColors).map(([key, value]) => (
              <marker
                key={key}
                id={`arrow-${key}`}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="3.3"
                markerHeight="3.3"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" fill={value} />
              </marker>
            ))}
          </defs>
          {arrows.map((a, i) => {
            const from = position(a.from),
              to = position(a.to);
            const angle = Math.atan2(to.y - from.y, to.x - from.x);
            return (
              <line
                key={i}
                x1={from.x}
                y1={from.y}
                x2={to.x - Math.cos(angle) * 16}
                y2={to.y - Math.sin(angle) * 16}
                stroke={drawingColors[a.color]}
                strokeWidth="12"
                strokeLinecap="round"
                opacity=".78"
                markerEnd={`url(#arrow-${a.color})`}
              />
            );
          })}
        </svg>
        {promotion && (
          <div className="promotion-picker">
            <strong>Promote to</strong>
            {['q', 'r', 'b', 'n'].map((p) => (
              <button
                key={p}
                onClick={() => {
                  onMove(promotion + p);
                  setPromotion(null);
                }}
                aria-label={`Promote to ${p}`}
              >
                <img src={`/pieces/${chess.turn()}${p.toUpperCase()}.svg`} alt={p} />
              </button>
            ))}
            <button onClick={() => setPromotion(null)}>Cancel</button>
          </div>
        )}
      </div>
    </div>
  );
}
