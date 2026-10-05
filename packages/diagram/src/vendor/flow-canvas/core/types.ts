/** Graph + interaction types for @internetmatt/flow-canvas — zero deps. */

export type EdgePathType = 'bezier' | 'straight' | 'step' | 'smoothstep';

export interface FlowPoint {
  x: number;
  y: number;
}

export interface Viewport {
  /** Flow-space origin offset in screen px (pan). */
  x: number;
  y: number;
  zoom: number;
}

export interface FlowNode {
  id: string;
  /** Visual / registry type key (default | input | output | custom). */
  type?: string;
  label?: string;
  position: FlowPoint;
  width?: number;
  height?: number;
  hidden?: boolean;
  data?: Record<string, unknown>;
  /** FlowDeclaration registry node id when bridged. */
  node?: string;
  selected?: boolean;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: EdgePathType;
  hidden?: boolean;
  label?: string;
  selected?: boolean;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
  viewport?: Viewport;
}

export interface HandleRef {
  nodeId: string;
  handleId: string;
  position: 'left' | 'right' | 'top' | 'bottom';
}

export interface ConnectionDraft {
  from: HandleRef;
  to: FlowPoint;
}

export type FlowStoreListener = () => void;

export const DEFAULT_NODE_WIDTH = 180;
export const DEFAULT_NODE_HEIGHT = 40;
export const DEFAULT_VIEWPORT: Viewport = { x: 0, y: 0, zoom: 1 };
