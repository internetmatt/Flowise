import { getFamily } from './families'
import type { DiagramDocument, DiagramEdge, DiagramNode } from './schema'
import { cleanEdge, cleanNode } from './schema'

export function documentFromCanvas(current: DiagramDocument, nodes: DiagramNode[], edges: DiagramEdge[]): DiagramDocument {
    const family = getFamily(current.family)
    const nextNodes = nodes.map(cleanNode)
    const nextEdges = edges.map((edge, index) =>
        cleanEdge({
            ...edge,
            id: edge.id || `e-${edge.source}-${edge.target}-${index}`
        })
    )
    const dsl = family.hasDslRoundTrip ? family.serialize(nextNodes, nextEdges, current.dsl) : current.dsl
    return {
        ...current,
        dsl,
        nodes: nextNodes,
        edges: nextEdges
    }
}

/** Parse dsl into nodes and edges. On failure the previous document is returned unchanged. */
export function tryApplyDsl(current: DiagramDocument, dsl: string): { document: DiagramDocument; error: string | null } {
    const family = getFamily(current.family)
    if (!family.hasDslRoundTrip) {
        return { document: current, error: `Family ${current.family} does not support DSL round-trip yet` }
    }
    try {
        const parsed = family.parseDsl(dsl)
        const nodes = parsed.nodes.map((node) => {
            const previous = current.nodes.find((item) => item.id === node.id)
            if (!previous) return node
            return { ...node, position: previous.position, width: previous.width, height: previous.height }
        })
        return {
            document: {
                ...current,
                dsl: parsed.dsl,
                nodes,
                edges: parsed.edges
            },
            error: null
        }
    } catch (error) {
        return { document: current, error: error instanceof Error ? error.message : String(error) }
    }
}

export function extractDsl(content: string): string {
    const fence = content.match(/```(?:mermaid)?\s*([\s\S]*?)```/i)
    return (fence?.[1] ?? content).trim()
}

export function applyGeneratedCompletion(current: DiagramDocument, content: string): { document: DiagramDocument; error: string | null } {
    if (current.family !== 'flowchart') {
        return { document: current, error: 'Generation currently supports flowchart only' }
    }
    const applied = tryApplyDsl(current, extractDsl(content))
    if (applied.error) return { document: current, error: applied.error }
    return applied
}
