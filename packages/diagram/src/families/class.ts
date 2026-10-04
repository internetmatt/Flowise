import { cleanEdge, cleanNode, DIAGRAM_SCHEMA, type DiagramDocument, type DiagramEdge, type DiagramNode } from '../schema'
import type { DiagramFamilyModule, FamilyGraph } from './types'

function empty(): DiagramDocument {
    return {
        schema: DIAGRAM_SCHEMA,
        family: 'class',
        dsl: 'classDiagram\n',
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
        if (/^classDiagram\b/i.test(line)) {
            sawHeader = true
            continue
        }
        if (!sawHeader) throw new Error('Could not parse class DSL: expected "classDiagram" header')
        const inherit = line.match(/^([A-Za-z_][\w-]*)\s*<\|--\s*([A-Za-z_][\w-]*)$/)
        if (inherit) {
            remember(nodes, inherit[1])
            remember(nodes, inherit[2])
            edges.push(
                cleanEdge({ id: `e-${inherit[2]}-${inherit[1]}-${edges.length}`, source: inherit[2], target: inherit[1], label: 'extends' })
            )
            continue
        }
        const link = line.match(/^([A-Za-z_][\w-]*)\s*-->\s*([A-Za-z_][\w-]*)(?:\s*:\s*(.+))?$/)
        if (link) {
            remember(nodes, link[1])
            remember(nodes, link[2])
            edges.push(
                cleanEdge({
                    id: `e-${link[1]}-${link[2]}-${edges.length}`,
                    source: link[1],
                    target: link[2],
                    ...(link[3]?.trim() ? { label: link[3].trim() } : {})
                })
            )
            continue
        }
        const member = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.+)$/)
        if (member) {
            remember(nodes, member[1], member[2].trim())
            continue
        }
        const klass = line.match(/^class\s+([A-Za-z_][\w-]*)(?:\s*\{\s*\})?$/)
        if (klass) {
            remember(nodes, klass[1])
            continue
        }
        if (/^[A-Za-z_][\w-]*$/.test(line)) {
            remember(nodes, line)
            continue
        }
        throw new Error(`Could not parse class DSL: ${line}`)
    }
    if (!sawHeader) throw new Error('Could not parse class DSL: expected "classDiagram" header')
    return { nodes: [...nodes.values()], edges, dsl: dsl.trimEnd() }
}

function serialize(nodes: DiagramNode[], edges: DiagramEdge[]): string {
    const lines = ['classDiagram']
    const used = new Set<string>()
    for (const edge of edges) {
        if (edge.label === 'extends') {
            lines.push(`  ${edge.target} <|-- ${edge.source}`)
        } else {
            const label = edge.label ? ` : ${edge.label}` : ''
            lines.push(`  ${edge.source} --> ${edge.target}${label}`)
        }
        used.add(edge.source)
        used.add(edge.target)
    }
    for (const node of nodes) {
        if (!used.has(node.id)) lines.push(`  class ${node.id}`)
    }
    return lines.join('\n')
}

function remember(nodes: Map<string, DiagramNode>, id: string, member?: string) {
    const existing = nodes.get(id)
    const label = member && existing ? `${existing.data.label}\n${member}` : member || id
    nodes.set(
        id,
        cleanNode({
            id,
            type: 'class',
            position: existing?.position ?? { x: 0, y: 0 },
            data: { label: existing && !member ? existing.data.label : label, shape: 'rect' },
            width: existing?.width,
            height: existing?.height
        })
    )
}

export const classFamily: DiagramFamilyModule = {
    id: 'class',
    label: 'Class',
    editable: true,
    hasDslRoundTrip: true,
    emptyDocument: empty,
    parseDsl,
    serialize,
    defaultNodeLabel: (index) => `Class${index}`
}
