import type { FlowNode, FlowPoint } from './types.ts';
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from './types.ts';

/** Top-most (last in array) node containing the flow-space point. */
export function nodeAtPoint(nodes: FlowNode[], point: FlowPoint): FlowNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i]!;
    if (n.hidden) continue;
    const w = n.width ?? DEFAULT_NODE_WIDTH;
    const h = n.height ?? DEFAULT_NODE_HEIGHT;
    if (
      point.x >= n.position.x &&
      point.x <= n.position.x + w &&
      point.y >= n.position.y &&
      point.y <= n.position.y + h
    ) {
      return n;
    }
  }
  return null;
}

export function handleAnchor(
  node: FlowNode,
  side: 'left' | 'right' | 'top' | 'bottom',
): FlowPoint {
  const w = node.width ?? DEFAULT_NODE_WIDTH;
  const h = node.height ?? DEFAULT_NODE_HEIGHT;
  switch (side) {
    case 'left':
      return { x: node.position.x, y: node.position.y + h / 2 };
    case 'right':
      return { x: node.position.x + w, y: node.position.y + h / 2 };
    case 'top':
      return { x: node.position.x + w / 2, y: node.position.y };
    case 'bottom':
      return { x: node.position.x + w / 2, y: node.position.y + h };
  }
}
