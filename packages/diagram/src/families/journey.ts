import { cleanEdge, cleanNode, DIAGRAM_SCHEMA, type DiagramDocument, type DiagramEdge, type DiagramNode } from '../schema'
import type { DiagramFamilyModule, FamilyGraph } from './types'

function empty(): DiagramDocument {
    return {
        schema: DIAGRAM_SCHEMA,
        family: 'journey',
        dsl: 'journey\n  title Journey\n',
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
    }
}

function parseDsl(dsl: string): FamilyGraph {
    const nodes: DiagramNode[] = []
    const edges: DiagramEdge[] = []
    let sawHeader = false
    let section = 'Journey'
    let previous: string | null = null
    let index = 0

    for (const raw of dsl.split(/\r?\n/)) {
        const line = raw.trim()
        if (!line || line.startsWith('%%')) continue
        if (/^journey\b/i.test(line)) {
            sawHeader = true
            continue
        }
        if (!sawHeader) throw new Error('Could not parse journey DSL: expected "journey" header')
        if (/^title\s+/i.test(line)) continue
        const sectionMatch = line.match(/^section\s+(.+)$/i)
        if (sectionMatch) {
            section = sectionMatch[1].trim()
            previous = null
            continue
        }
        const step = line.match(/^(.+?)\s*:\s*(\d+)\s*:\s*(.+)$/)
        if (step) {
            const id = `S${index++}`
            nodes.push(
                cleanNode({
                    id,
                    type: 'journey',
                    position: { x: index * 180, y: 80 },
                    data: { label: `${step[1].trim()} (${section})`, shape: 'rect' }
                })
            )
            if (previous) {
                edges.push(cleanEdge({ id: `e-${previous}-${id}`, source: previous, target: id, label: step[2] }))
            }
            previous = id
            continue
        }
        throw new Error(`Could not parse journey DSL: ${line}`)
    }

    if (!sawHeader) throw new Error('Could not parse journey DSL: expected "journey" header')
    return { nodes, edges, dsl: dsl.trimEnd() }
}

function serialize(nodes: DiagramNode[], edges: DiagramEdge[]): string {
    const lines = ['journey', '  title Journey', '  section Path']
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const ordered = orderNodes(nodes, edges)
    for (const id of ordered) {
        const node = byId.get(id)
        if (!node) continue
        const score = edges.find((edge) => edge.target === id)?.label || '3'
        const label = node.data.label.replace(/\s*\([^)]*\)\s*$/, '')
        lines.push(`    ${label}: ${score}: Me`)
    }
    return lines.join('\n')
}

function orderNodes(nodes: DiagramNode[], edges: DiagramEdge[]): string[] {
    if (nodes.length === 0) return []
    const targets = new Set(edges.map((edge) => edge.target))
    const start = nodes.find((node) => !targets.has(node.id)) || nodes[0]
    const next = new Map(edges.map((edge) => [edge.source, edge.target]))
    const ordered: string[] = []
    let cursor: string | undefined = start.id
    const seen = new Set<string>()
    while (cursor && !seen.has(cursor)) {
        ordered.push(cursor)
        seen.add(cursor)
        cursor = next.get(cursor)
    }
    for (const node of nodes) {
        if (!seen.has(node.id)) ordered.push(node.id)
    }
    return ordered
}

export const journeyFamily: DiagramFamilyModule = {
    id: 'journey',
    label: 'Journey',
    editable: true,
    hasDslRoundTrip: true,
    emptyDocument: empty,
    parseDsl,
    serialize,
    defaultNodeLabel: (index) => `Step ${index}`
}
