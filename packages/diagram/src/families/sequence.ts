import { cleanEdge, cleanNode, DIAGRAM_SCHEMA, type DiagramDocument, type DiagramEdge, type DiagramNode } from '../schema'
import type { DiagramFamilyModule, FamilyGraph } from './types'

function empty(): DiagramDocument {
    return {
        schema: DIAGRAM_SCHEMA,
        family: 'sequence',
        dsl: 'sequenceDiagram\n',
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
    }
}

function parseDsl(dsl: string): FamilyGraph {
    const nodes = new Map<string, DiagramNode>()
    const edges: DiagramEdge[] = []
    let sawHeader = false
    let order = 0
    for (const raw of dsl.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith('%%')) continue
        if (/^sequenceDiagram\b/i.test(line)) {
            sawHeader = true
            continue
        }
        if (!sawHeader) throw new Error('Could not parse sequence DSL: expected "sequenceDiagram" header')
        const participant = line.match(/^(?:participant|actor)\s+([A-Za-z_][\w-]*)(?:\s+as\s+(.+))?$/i)
        if (participant) {
            remember(nodes, participant[1], participant[2]?.trim() || participant[1], order++)
            continue
        }
        const message = line.match(/^([A-Za-z_][\w-]*)\s*(-?>>?-?>)\s*([A-Za-z_][\w-]*)\s*:\s*(.+)$/)
        if (message) {
            remember(nodes, message[1], message[1], order++)
            remember(nodes, message[3], message[3], order++)
            edges.push(
                cleanEdge({
                    id: `e-${message[1]}-${message[3]}-${edges.length}`,
                    source: message[1],
                    target: message[3],
                    label: message[4].trim()
                })
            )
            continue
        }
        throw new Error(`Could not parse sequence DSL: ${line}`)
    }
    if (!sawHeader) throw new Error('Could not parse sequence DSL: expected "sequenceDiagram" header')
    return { nodes: [...nodes.values()], edges, dsl: dsl.trimEnd() }
}

function serialize(nodes: DiagramNode[], edges: DiagramEdge[]): string {
    const lines = ['sequenceDiagram']
    for (const node of nodes) {
        if (node.data.label && node.data.label !== node.id) {
            lines.push(`  participant ${node.id} as ${node.data.label}`)
        } else {
            lines.push(`  participant ${node.id}`)
        }
    }
    for (const edge of edges) {
        lines.push(`  ${edge.source}->>${edge.target}: ${edge.label || 'message'}`)
    }
    return lines.join('\n')
}

function remember(nodes: Map<string, DiagramNode>, id: string, label: string, order: number) {
    if (nodes.has(id)) return
    nodes.set(
        id,
        cleanNode({
            id,
            type: 'sequence',
            position: { x: order * 180, y: 40 },
            data: { label, shape: 'rect' }
        })
    )
}

export const sequenceFamily: DiagramFamilyModule = {
    id: 'sequence',
    label: 'Sequence',
    editable: true,
    hasDslRoundTrip: true,
    emptyDocument: empty,
    parseDsl,
    serialize,
    defaultNodeLabel: (index) => `Actor${index}`
}
