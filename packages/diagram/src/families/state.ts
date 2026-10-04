import { cleanEdge, cleanNode, DIAGRAM_SCHEMA, type DiagramDocument, type DiagramEdge, type DiagramNode } from '../schema'
import type { DiagramFamilyModule, FamilyGraph } from './types'

function empty(): DiagramDocument {
    return {
        schema: DIAGRAM_SCHEMA,
        family: 'state',
        dsl: 'stateDiagram-v2\n',
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
    }
}

function parseDsl(dsl: string): FamilyGraph {
    const nodes = new Map<string, DiagramNode>()
    const edges: DiagramEdge[] = []
    let sawHeader = false
    for (const raw of dsl.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith('%%')) continue
        if (/^stateDiagram(?:-v2)?\b/i.test(line)) {
            sawHeader = true
            continue
        }
        if (!sawHeader) throw new Error('Could not parse state DSL: expected "stateDiagram-v2" header')
        const transition = line.match(/^(\[\*\]|[A-Za-z_][\w-]*)\s*-->\s*(\[\*\]|[A-Za-z_][\w-]*)(?:\s*:\s*(.+))?$/)
        if (transition) {
            const source = normalizeState(transition[1], 'source')
            const target = normalizeState(transition[2], 'target')
            remember(nodes, source.id, source.label, source.shape)
            remember(nodes, target.id, target.label, target.shape)
            edges.push(
                cleanEdge({
                    id: `e-${source.id}-${target.id}-${edges.length}`,
                    source: source.id,
                    target: target.id,
                    ...(transition[3]?.trim() ? { label: transition[3].trim() } : {})
                })
            )
            continue
        }
        const named = line.match(/^state\s+"([^"]+)"\s+as\s+([A-Za-z_][\w-]*)$/i)
        if (named) {
            remember(nodes, named[2], named[1], 'rect')
            continue
        }
        throw new Error(`Could not parse state DSL: ${line}`)
    }
    if (!sawHeader) throw new Error('Could not parse state DSL: expected "stateDiagram-v2" header')
    return { nodes: [...nodes.values()], edges, dsl: dsl.trimEnd() }
}

function serialize(nodes: DiagramNode[], edges: DiagramEdge[]): string {
    const lines = ['stateDiagram-v2']
    const byId = new Map(nodes.map((node) => [node.id, node]))
    for (const edge of edges) {
        const source = token(byId.get(edge.source) || { id: edge.source, data: { label: edge.source, shape: 'rect' } })
        const target = token(byId.get(edge.target) || { id: edge.target, data: { label: edge.target, shape: 'rect' } })
        const label = edge.label ? ` : ${edge.label}` : ''
        lines.push(`  ${source} --> ${target}${label}`)
    }
    return lines.join('\n')
}

function normalizeState(token: string, role: 'source' | 'target'): { id: string; label: string; shape: string } {
    if (token === '[*]') {
        return { id: role === 'source' ? '__start__' : '__end__', label: '[*]', shape: 'circle' }
    }
    return { id: token, label: token, shape: 'rect' }
}

function token(node: { id: string; data: { label: string; shape?: string } }): string {
    if (node.id === '__start__' || node.id === '__end__' || node.data.shape === 'circle') return '[*]'
    return node.id
}

function remember(nodes: Map<string, DiagramNode>, id: string, label: string, shape: string) {
    if (!nodes.has(id)) {
        nodes.set(id, cleanNode({ id, type: 'state', position: { x: 0, y: 0 }, data: { label, shape } }))
    }
}

export const stateFamily: DiagramFamilyModule = {
    id: 'state',
    label: 'State',
    editable: true,
    hasDslRoundTrip: true,
    emptyDocument: empty,
    parseDsl,
    serialize,
    defaultNodeLabel: (index) => `State${index}`
}
