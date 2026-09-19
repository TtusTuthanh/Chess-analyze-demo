export type DrawingColor = 'G' | 'R' | 'B' | 'Y';
export interface Arrow {
  from: string;
  to: string;
  color: DrawingColor;
}
export interface Highlight {
  square: string;
  color: DrawingColor;
}
export interface Annotation {
  comment: string;
  nags: number[];
  arrows: Arrow[];
  highlights: Highlight[];
}
export interface MoveNode {
  id: string;
  parent: string | null;
  children: string[];
  ply: number;
  san: string;
  uci: string;
  fen: string;
  annotation: Annotation;
}
export interface Game {
  headers: Record<string, string>;
  nodes: Record<string, MoveNode>;
  root: string;
  originalPgn: string;
}
export interface EngineLine {
  rank: number;
  cp: number;
  mate?: number;
  depth: number;
  pv: string[];
  san: string[];
}
export interface EngineAnalysis {
  fen: string;
  depth: number;
  cp: number;
  mate?: number;
  bestMove: string;
  lines: EngineLine[];
  nodes: number;
  nps: number;
  timestamp: number;
  complete: boolean;
  multiPV: number;
}
export interface EngineSettings {
  depth: number;
  multiPV: number;
}
export interface Thresholds {
  inaccuracy: number;
  mistake: number;
  blunder: number;
}
export type Classification =
  'Best move' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder' | 'Missed win';
export interface MoveAssessment {
  label: Classification;
  loss: number | null;
  before: EngineAnalysis;
  after: EngineAnalysis;
  best: string;
  mateChange: boolean;
}
export interface Project {
  version: 1;
  game: Game;
  current: string;
  analyses: Record<string, EngineAnalysis>;
  settings: EngineSettings;
  thresholds: Thresholds;
}
