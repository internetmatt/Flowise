import type { FlowNode, FlowPoint, Viewport } from './types.ts'
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from './types.ts'

/** Flow (graph) → screen pixels. */
export function flowToScreen(point: FlowPoint, viewport: Viewport): FlowPoint {
    return {
        x: point.x * viewport.zoom + viewport.x,
        y: point.y * viewport.zoom + viewport.y
    }
}

/** Screen pixels → flow (graph). */
export function screenToFlow(point: FlowPoint, viewport: Viewport): FlowPoint {
    return {
        x: (point.x - viewport.x) / viewport.zoom,
        y: (point.y - viewport.y) / viewport.zoom
    }
}

export function clampZoom(zoom: number, min = 0.1, max = 4): number {
    return Math.min(max, Math.max(min, zoom))
}

/** Zoom around a screen-space anchor (keeps that point stable). */
export function zoomAt(viewport: Viewport, screenAnchor: FlowPoint, nextZoom: number): Viewport {
    const z = clampZoom(nextZoom)
    const flow = screenToFlow(screenAnchor, viewport)
    return {
        zoom: z,
        x: screenAnchor.x - flow.x * z,
        y: screenAnchor.y - flow.y * z
    }
}

export interface FitViewOptions {
    padding?: number
    width: number
    height: number
    minZoom?: number
    maxZoom?: number
}

/** Fit all visible nodes into the viewport box. */
export function fitView(nodes: FlowNode[], opts: FitViewOptions): Viewport {
    const visible = nodes.filter((n) => !n.hidden)
    if (visible.length === 0) {
        return { x: opts.width / 2, y: opts.height / 2, zoom: 1 }
    }

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const n of visible) {
        const w = n.width ?? DEFAULT_NODE_WIDTH
        const h = n.height ?? DEFAULT_NODE_HEIGHT
        minX = Math.min(minX, n.position.x)
        minY = Math.min(minY, n.position.y)
        maxX = Math.max(maxX, n.position.x + w)
        maxY = Math.max(maxY, n.position.y + h)
    }

    const pad = opts.padding ?? 40
    const bw = maxX - minX || 1
    const bh = maxY - minY || 1
    const zoom = clampZoom(Math.min((opts.width - pad * 2) / bw, (opts.height - pad * 2) / bh), opts.minZoom ?? 0.1, opts.maxZoom ?? 2)

    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2

    return {
        zoom,
        x: opts.width / 2 - cx * zoom,
        y: opts.height / 2 - cy * zoom
    }
}

export function viewportTransform(viewport: Viewport): string {
    return `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`
}
