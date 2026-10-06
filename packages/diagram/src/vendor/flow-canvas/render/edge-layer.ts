import { getEdgePath } from '../core/edges.ts'
import { handleAnchor } from '../core/hit-test.ts'
import type { ConnectionDraft, FlowEdge, FlowNode, Viewport } from '../core/types.ts'
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from '../core/types.ts'

export interface EdgeLayerColors {
    edge: string
    edgeSelected: string
    connection: string
    background: string
    grid: string
}

const DEFAULT_COLORS: EdgeLayerColors = {
    edge: '#666666',
    edgeSelected: '#0078D4',
    connection: '#0078D4',
    background: 'transparent',
    grid: 'rgba(0,0,0,0.06)'
}

function nodeMap(nodes: FlowNode[]): Map<string, FlowNode> {
    return new Map(nodes.map((n) => [n.id, n]))
}

function endpoint(
    nodes: Map<string, FlowNode>,
    nodeId: string,
    handleId: string | undefined,
    fallback: 'left' | 'right'
): { x: number; y: number } | null {
    const node = nodes.get(nodeId)
    if (!node || node.hidden) return null
    const side = handleId === 'left' || handleId === 'right' || handleId === 'top' || handleId === 'bottom' ? handleId : fallback
    return handleAnchor(node, side)
}

/** Draw grid + edges + connection draft onto a Canvas2D context (GPU-friendly path later). */
export function paintEdgeLayer(
    ctx: CanvasRenderingContext2D,
    opts: {
        width: number
        height: number
        viewport: Viewport
        nodes: FlowNode[]
        edges: FlowEdge[]
        connection?: ConnectionDraft | null
        colors?: Partial<EdgeLayerColors>
        showGrid?: boolean
    }
): void {
    const colors = { ...DEFAULT_COLORS, ...opts.colors }
    const { width, height, viewport } = opts
    const dpr = typeof devicePixelRatio === 'number' ? devicePixelRatio : 1

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    if (opts.showGrid !== false) {
        paintGrid(ctx, width, height, viewport, colors.grid)
    }

    ctx.save()
    ctx.translate(viewport.x, viewport.y)
    ctx.scale(viewport.zoom, viewport.zoom)

    const nodes = nodeMap(opts.nodes)

    for (const edge of opts.edges) {
        if (edge.hidden) continue
        const source = endpoint(nodes, edge.source, edge.sourceHandle, 'right')
        const target = endpoint(nodes, edge.target, edge.targetHandle, 'left')
        if (!source || !target) continue

        const path = getEdgePath(edge.type, source, target)
        const p = new Path2D(path.d)
        ctx.strokeStyle = edge.selected ? colors.edgeSelected : colors.edge
        ctx.lineWidth = edge.selected ? 2.5 : 1.75
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke(p)

        if (edge.label) {
            ctx.fillStyle = colors.edgeSelected
            ctx.font = '12px var(--typography-font-family-base, system-ui, sans-serif)'
            ctx.textAlign = 'center'
            ctx.fillText(edge.label, path.labelX, path.labelY - 6)
        }
    }

    if (opts.connection) {
        const fromNode = nodes.get(opts.connection.from.nodeId)
        if (fromNode) {
            const source = handleAnchor(fromNode, opts.connection.from.position)
            const path = getEdgePath('bezier', source, opts.connection.to)
            ctx.strokeStyle = colors.connection
            ctx.lineWidth = 2
            ctx.setLineDash([6, 4])
            ctx.stroke(new Path2D(path.d))
            ctx.setLineDash([])
        }
    }

    ctx.restore()
}

function paintGrid(ctx: CanvasRenderingContext2D, width: number, height: number, viewport: Viewport, color: string): void {
    const gap = 20 * viewport.zoom
    if (gap < 8) return
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    const ox = viewport.x % gap
    const oy = viewport.y % gap
    ctx.beginPath()
    for (let x = ox; x < width; x += gap) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
    }
    for (let y = oy; y < height; y += gap) {
        ctx.moveTo(0, y)
        ctx.lineTo(width, y)
    }
    ctx.stroke()
    ctx.restore()
}

/** Bounds helper for minimap. */
export function graphBounds(nodes: FlowNode[]): {
    minX: number
    minY: number
    maxX: number
    maxY: number
} {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
        if (n.hidden) continue
        const w = n.width ?? DEFAULT_NODE_WIDTH
        const h = n.height ?? DEFAULT_NODE_HEIGHT
        minX = Math.min(minX, n.position.x)
        minY = Math.min(minY, n.position.y)
        maxX = Math.max(maxX, n.position.x + w)
        maxY = Math.max(maxY, n.position.y + h)
    }
    if (!Number.isFinite(minX)) {
        return { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    }
    return { minX, minY, maxX, maxY }
}
