import { cleanEdge, cleanNode, DIAGRAM_SCHEMA, type DiagramDocument, type DiagramEdge, type DiagramNode } from '../schema'
import type { DiagramFamilyModule, FamilyGraph } from './types'

function empty(): DiagramDocument {
    return {
        schema: DIAGRAM_SCHEMA,
        family: 'mindmap',
        dsl: 'mindmap\n  root((Idea))\n',
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
    }
}

function parseDsl(dsl: string): FamilyGraph {
    const nodes = new Map<string, DiagramNode>()
    const edges: DiagramEdge[] = []
    let sawHeader = false
    const stack: Array<{ id: string; indent: number }> = []
    let counter = 0

    for (const raw of dsl.split(/\r?\n/)) {
        if (!raw.trim() || raw.trim().startsWith('%%')) continue
        if (/^\s*mindmap\b/i.test(raw)) {
            sawHeader = true
            continue
        }
        if (!sawHeader) throw new Error('Could not parse mindmap DSL: expected "mindmap" header')
        const match = raw.match(/^(\s*)(.+)$/)
        if (!match) continue
        const indent = match[1].length
        const text = match[2].trim()
        const labelMatch = text.match(/^(?:root)?\(\((.+)\)\)$/) || text.match(/^\[(.+)\]$/) || text.match(/^(.+)$/)
        const label = (labelMatch?.[1] || text).trim()
        const id = `n${counter++}`
        const shape = text.includes('((') ? 'circle' : 'rect'
        nodes.set(id, cleanNode({ id, type: 'mindmap', position: { x: indent * 40, y: counter * 64 }, data: { label, shape } }))
        while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
        const parent = stack[stack.length - 1]
        if (parent) {
            edges.push(cleanEdge({ id: `e-${parent.id}-${id}`, source: parent.id, target: id }))
        }
        stack.push({ id, indent })
    }

    if (!sawHeader) throw new Error('Could not parse mindmap DSL: expected "mindmap" header')
    return { nodes: [...nodes.values()], edges, dsl: dsl.trimEnd() }
}

function serialize(nodes: DiagramNode[], edges: DiagramEdge[]): string {
    const children = new Map<string, string[]>()
    const targets = new Set(edges.map((edge) => edge.target))
    for (const edge of edges) {
        const list = children.get(edge.source) || []
        list.push(edge.target)
        children.set(edge.source, list)
    }
    const roots = nodes.filter((node) => !targets.has(node.id))
    const lines = ['mindmap']
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const walk = (id: string, depth: number) => {
        const node = byId.get(id)
        if (!node) return
        const pad = '  '.repeat(depth + 1)
        const token = node.data.shape === 'circle' ? `${depth === 0 ? 'root' : ''}((${node.data.label}))` : node.data.label
        lines.push(`${pad}${token}`)
        for (const child of children.get(id) || []) walk(child, depth + 1)
    }
    for (const root of roots) walk(root.id, 0)
    if (roots.length === 0 && nodes[0]) walk(nodes[0].id, 0)
    return lines.join('\n')
}

export const mindmapFamily: DiagramFamilyModule = {
    id: 'mindmap',
    label: 'Mindmap',
    editable: true,
    hasDslRoundTrip: true,
    emptyDocument: empty,
    parseDsl,
    serialize,
    defaultNodeLabel: (index) => `Topic ${index}`
}
