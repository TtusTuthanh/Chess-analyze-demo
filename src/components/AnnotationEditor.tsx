import { useState } from 'react';
import {
  MessageSquare,
  GitBranch,
  CornerUpRight,
  Highlighter,
  Check,
  X,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { Annotation, DrawingColor, MoveNode } from '../types';
import type { BoardTool } from './ChessBoard';
import { drawingColors } from './ChessBoard';
import { moveLabel, NAGS } from '../lib/pgn';
interface Props {
  node: MoveNode;
  draft: Annotation;
  onDraft: (draft: Annotation) => void;
  onSave: () => void;
  onCancel: () => void;
  onVariation: (text: string) => boolean;
  tool: BoardTool;
  setTool: (tool: BoardTool) => void;
  color: DrawingColor;
  setColor: (color: DrawingColor) => void;
  dirty: boolean;
  onUndo: () => void;
  canUndo: boolean;
}
export function AnnotationEditor({
  node,
  draft,
  onDraft,
  onSave,
  onCancel,
  onVariation,
  tool,
  setTool,
  color,
  setColor,
  dirty,
  onUndo,
  canUndo,
}: Props) {
  const [tab, setTab] = useState<'comment' | 'variation'>('comment');
  const [variation, setVariation] = useState('');
  return (
    <section className="panel annotation-panel">
      <div className="panel-title">
        <span>
          <MessageSquare size={17} />
          Annotations
        </span>
        <span className="position-tag">{node.parent ? moveLabel(node) : 'Start'}</span>
      </div>
      <div className="annotation-body">
        <div className="small-tabs">
          <button className={tab === 'comment' ? 'active' : ''} onClick={() => setTab('comment')}>
            Comment
          </button>
          <button
            className={tab === 'variation' ? 'active' : ''}
            onClick={() => setTab('variation')}
          >
            <GitBranch size={13} />
            Variation
          </button>
        </div>
        {tab === 'comment' ? (
          <textarea
            aria-label="Move comment"
            placeholder="What’s the idea behind this move?"
            value={draft.comment}
            onChange={(e) => onDraft({ ...draft, comment: e.target.value })}
            maxLength={10000}
          />
        ) : (
          <div className="variation-editor">
            <textarea
              aria-label="Variation moves"
              value={variation}
              onChange={(e) => setVariation(e.target.value)}
              placeholder={node.fen.split(' ')[1] === 'w' ? 'e.g. Nf3 Nc6 Bc4' : 'e.g. Nf6 Nc3'}
            />
            <p>Continue from this position. Use SAN or UCI notation.</p>
            <button
              className="button subtle small"
              disabled={!variation.trim()}
              onClick={() => {
                if (onVariation(variation)) setVariation('');
              }}
            >
              <GitBranch size={13} />
              Add variation
            </button>
          </div>
        )}
        <div className="field-caption">MOVE SYMBOL</div>
        <div className="nag-picker">
          <button
            className={!draft.nags.length ? 'selected' : ''}
            onClick={() => onDraft({ ...draft, nags: [] })}
            title="No NAG"
          >
            —
          </button>
          {Object.entries(NAGS).map(([n, symbol]) => (
            <button
              key={n}
              title={
                {
                  1: 'Good move',
                  2: 'Mistake',
                  3: 'Brilliant move (manual)',
                  4: 'Blunder',
                  5: 'Interesting move',
                  6: 'Dubious move',
                }[Number(n)]
              }
              className={draft.nags.includes(Number(n)) ? 'selected' : ''}
              onClick={() => onDraft({ ...draft, nags: [Number(n)] })}
            >
              {symbol}
            </button>
          ))}
        </div>
        <div className="drawing-tools">
          <span className="field-caption">DRAW ON BOARD</span>
          <div>
            <button
              className={tool === 'arrow' ? 'selected' : ''}
              aria-label="Draw arrow"
              title="Draw arrow: drag between squares"
              onClick={() => setTool(tool === 'arrow' ? 'move' : 'arrow')}
            >
              <CornerUpRight size={17} />
            </button>
            <button
              className={tool === 'highlight' ? 'selected' : ''}
              aria-label="Highlight square"
              title="Highlight square"
              onClick={() => setTool(tool === 'highlight' ? 'move' : 'highlight')}
            >
              <Highlighter size={16} />
            </button>
            <span className="tool-divider" />
            <select
              aria-label="Drawing color"
              value={color}
              style={{ color: drawingColors[color] }}
              onChange={(e) => setColor(e.target.value as DrawingColor)}
            >
              <option value="G">● Green</option>
              <option value="R">● Red</option>
              <option value="B">● Blue</option>
              <option value="Y">● Gold</option>
            </select>
            <button
              title="Clear drawings"
              aria-label="Clear drawings"
              disabled={!draft.arrows.length && !draft.highlights.length}
              onClick={() => onDraft({ ...draft, arrows: [], highlights: [] })}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="annotation-actions">
          <button
            className="icon-button"
            title="Undo annotation (Ctrl+Z)"
            aria-label="Undo annotation"
            onClick={onUndo}
            disabled={!canUndo}
          >
            <Undo2 size={15} />
          </button>
          <span>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
          {dirty && (
            <button
              className="icon-button"
              title="Cancel changes"
              aria-label="Cancel changes"
              onClick={onCancel}
            >
              <X size={15} />
            </button>
          )}
          <button className="button primary small" disabled={!dirty} onClick={onSave}>
            <Check size={14} />
            Save
          </button>
        </div>
      </div>
    </section>
  );
}
