import { cleanEdge, cleanNode, DIAGRAM_SCHEMA, type DiagramDocument, type DiagramEdge, type DiagramNode } from '../schema'
import type { DiagramFamilyModule, FamilyGraph } from './types'

function empty(): DiagramDocument {
    return {
        schema: DIAGRAM_SCHEMA,
        family: 'er',
        dsl: 'erDiagram\n',
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
        if (/^erDiagram\b/i.test(line)) {
            sawHeader = true
            continue
        }
        if (!sawHeader) throw new Error('Could not parse ER DSL: expected "erDiagram" header')
        if (line.endsWith('{')) {
            const id = line.slice(0, -1).trim()
            if (!/^[A-Za-z_][\w-]*$/.test(id)) throw new Error(`Could not parse ER DSL: ${line}`)
            remember(nodes, id)
            continue
        }
        if (line === '}') continue
        const attr = line.match(/^(string|int|float|boolean|date|datetime|number)\s+([A-Za-z_][\w-]*)$/i)
        if (attr) continue
        const rel = line.match(/^([A-Za-z_][\w-]*)\s+([|o}{]{2}--[|o}{]{2})\s+([A-Za-z_][\w-]*)(?:\s*:\s*(.+))?$/)
        if (rel) {
            remember(nodes, rel[1])
            remember(nodes, rel[3])
            edges.push(
                cleanEdge({
                    id: `e-${rel[1]}-${rel[3]}-${edges.length}`,
                    source: rel[1],
                    target: rel[3],
                    label: (rel[4] || rel[2]).trim()
                })
            )
            continue
        }
        if (/^[A-Za-z_][\w-]*$/.test(line)) {
            remember(nodes, line)
            continue
        }
        throw new Error(`Could not parse ER DSL: ${line}`)
    }
    if (!sawHeader) throw new Error('Could not parse ER DSL: expected "erDiagram" header')
    return { nodes: [...nodes.values()], edges, dsl: dsl.trimEnd() }
}

function serialize(nodes: DiagramNode[], edges: DiagramEdge[]): string {
    const lines = ['erDiagram']
    const related = new Set<string>()
    for (const edge of edges) {
        lines.push(`  ${edge.source} ||--o{ ${edge.target} : ${edge.label || 'relates'}`)
        related.add(edge.source)
        related.add(edge.target)
    }
    for (const node of nodes) {
        if (!related.has(node.id)) lines.push(`  ${node.id}`)
    }
    return lines.join('\n')
}

function remember(nodes: Map<string, DiagramNode>, id: string) {
    if (!nodes.has(id)) {
        nodes.set(id, cleanNode({ id, type: 'er', position: { x: 0, y: 0 }, data: { label: id, shape: 'rect' } }))
    }
}

export const erFamily: DiagramFamilyModule = {
    id: 'er',
    label: 'ER',
    editable: true,
    hasDslRoundTrip: true,
    emptyDocument: empty,
    parseDsl,
    serialize,
    defaultNodeLabel: (index) => `Entity${index}`
}
