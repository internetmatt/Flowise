import type { EdgePathType, FlowPoint } from './types.ts';

export interface EdgePathResult {
  d: string;
  labelX: number;
  labelY: number;
}

function mid(a: number, b: number): number {
  return (a + b) / 2;
}

export function getStraightPath(
  source: FlowPoint,
  target: FlowPoint,
): EdgePathResult {
  return {
    d: `M ${source.x},${source.y} L ${target.x},${target.y}`,
    labelX: mid(source.x, target.x),
    labelY: mid(source.y, target.y),
  };
}

export function getBezierPath(
  source: FlowPoint,
  target: FlowPoint,
  curvature = 0.25,
): EdgePathResult {
  const dx = Math.abs(target.x - source.x);
  const offset = Math.max(40, dx * curvature);
  const c1 = { x: source.x + offset, y: source.y };
  const c2 = { x: target.x - offset, y: target.y };
  return {
    d: `M ${source.x},${source.y} C ${c1.x},${c1.y} ${c2.x},${c2.y} ${target.x},${target.y}`,
    labelX: mid(source.x, target.x),
    labelY: mid(source.y, target.y),
  };
}

export function getStepPath(
  source: FlowPoint,
  target: FlowPoint,
): EdgePathResult {
  const mx = mid(source.x, target.x);
  return {
    d: `M ${source.x},${source.y} L ${mx},${source.y} L ${mx},${target.y} L ${target.x},${target.y}`,
    labelX: mx,
    labelY: mid(source.y, target.y),
  };
}

/** Smoothstep with rounded corners (SVG quadratic approximations). */
export function getSmoothStepPath(
  source: FlowPoint,
  target: FlowPoint,
  borderRadius = 8,
): EdgePathResult {
  const mx = mid(source.x, target.x);
  const r = Math.min(borderRadius, Math.abs(mx - source.x) / 2, Math.abs(target.y - source.y) / 2);
  const dir = target.y >= source.y ? 1 : -1;

  if (Math.abs(target.y - source.y) < 1 || Math.abs(target.x - source.x) < 1) {
    return getStraightPath(source, target);
  }

  const d = [
    `M ${source.x},${source.y}`,
    `L ${mx - r},${source.y}`,
    `Q ${mx},${source.y} ${mx},${source.y + dir * r}`,
    `L ${mx},${target.y - dir * r}`,
    `Q ${mx},${target.y} ${mx + r},${target.y}`,
    `L ${target.x},${target.y}`,
  ].join(' ');

  return {
    d,
    labelX: mx,
    labelY: mid(source.y, target.y),
  };
}

export function getEdgePath(
  type: EdgePathType | undefined,
  source: FlowPoint,
  target: FlowPoint,
): EdgePathResult {
  switch (type) {
    case 'straight':
      return getStraightPath(source, target);
    case 'step':
      return getStepPath(source, target);
    case 'smoothstep':
      return getSmoothStepPath(source, target);
    case 'bezier':
    default:
      return getBezierPath(source, target);
  }
}
