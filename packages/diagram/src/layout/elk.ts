import ELK from 'elkjs/lib/elk-api.js'
import type { FlowDirection } from '../mermaid/flowchart'
import type { DiagramEdge, DiagramNode } from '../schema'

export type ElkGraph = {
    id: string
    layoutOptions: Record<string, string>
    children: Array<{ id: string; width: number; height: number }>
    edges: Array<{ id: string; sources: string[]; targets: string[] }>
}

const DIRECTION: Record<FlowDirection, string> = {
    TD: 'DOWN',
    TB: 'DOWN',
    BT: 'UP',
    LR: 'RIGHT',
    RL: 'LEFT'
}

export function nodeSize(node: DiagramNode): { width: number; height: number } {
    const label = node.data?.label || node.id
    return {
        width: node.width ?? Math.max(140, label.length * 8 + 32),
        height: node.height ?? (node.data?.shape === 'diamond' ? 72 : 48)
    }
}

export function elkGraph(nodes: DiagramNode[], edges: DiagramEdge[], direction: FlowDirection, family?: string): ElkGraph {
    const schematic = family === 'schematic'
    return {
        id: 'root',
        layoutOptions: schematic
            ? {
                  'elk.algorithm': 'layered',
                  'elk.edgeRouting': 'ORTHOGONAL',
                  'elk.direction': DIRECTION[direction],
                  'elk.spacing.nodeNode': '48',
                  'elk.layered.spacing.nodeNodeBetweenLayers': '64'
              }
            : {
                  'elk.algorithm': 'layered',
                  'elk.direction': DIRECTION[direction],
                  'elk.spacing.nodeNode': '48',
                  'elk.layered.spacing.nodeNodeBetweenLayers': '64'
              },
        children: nodes.map((node) => ({ id: node.id, ...nodeSize(node) })),
        edges: edges.map((edge) => ({ id: edge.id, sources: [edge.source], targets: [edge.target] }))
    }
}

export function applyElkPositions(
    nodes: DiagramNode[],
    result: { children?: Array<{ id: string; x?: number; y?: number; width?: number; height?: number }> }
): DiagramNode[] {
    const placed = new Map((result.children ?? []).map((child) => [child.id, child]))
    return nodes.map((node) => {
        const child = placed.get(node.id)
        if (!child) return node
        return {
            ...node,
            position: { x: child.x ?? node.position.x, y: child.y ?? node.position.y },
            width: child.width ?? node.width,
            height: child.height ?? node.height
        }
    })
}

export function fallbackGrid(nodes: DiagramNode[], direction: FlowDirection): DiagramNode[] {
    const horizontal = direction === 'LR' || direction === 'RL'
    return nodes.map((node, index) => ({
        ...node,
        position: horizontal ? { x: index * 200, y: 40 } : { x: 80, y: index * 120 }
    }))
}

export function layoutWithElk(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    direction: FlowDirection,
    workerUrl: string,
    family?: string
): Promise<DiagramNode[]> {
    const graph = elkGraph(nodes, edges, direction, family)
    if (nodes.length === 0) return Promise.resolve(nodes)
    if (typeof Worker === 'undefined') {
        return layoutOnMainThread(graph).then((result) => applyElkPositions(nodes, result))
    }
    return new Promise((resolve, reject) => {
        const worker = new Worker(workerUrl)
        const timer = setTimeout(() => {
            worker.terminate()
            reject(new Error('ELK worker timed out'))
        }, 15000)
        const cleanup = () => {
            clearTimeout(timer)
            worker.terminate()
        }
        worker.onerror = () => {
            cleanup()
            reject(new Error('ELK worker failed'))
        }
        try {
            // Use ELK's client protocol: register algorithms, correlate replies,
            // then apply the layout. The staged asset is the matching raw worker.
            const elk = new ELK({ workerFactory: () => worker })
            elk.layout(graph).then(
                (result) => {
                    cleanup()
                    resolve(applyElkPositions(nodes, result))
                },
                (error) => {
                    cleanup()
                    reject(error)
                }
            )
        } catch (error) {
            cleanup()
            reject(error)
        }
    })
}

async function layoutOnMainThread(graph: ElkGraph) {
    const { layoutGraph } = await import('./layoutGraph')
    return layoutGraph(graph)
}
