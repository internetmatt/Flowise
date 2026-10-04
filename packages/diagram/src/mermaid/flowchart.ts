import { cleanEdge, cleanNode, type DiagramEdge, type DiagramNode } from '../schema'

export type FlowDirection = 'TD' | 'TB' | 'BT' | 'LR' | 'RL'

export type FlowchartGraph = {
    direction: FlowDirection
    nodes: DiagramNode[]
    edges: DiagramEdge[]
}

const DIRECTIONS = new Set(['TD', 'TB', 'BT', 'LR', 'RL'])

export function readDirection(dsl: string): FlowDirection {
    const line = dsl
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .find((entry) => entry && !entry.startsWith('%%'))
    const match = line?.match(/^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\b/i)
    const direction = match?.[1]?.toUpperCase()
    return direction && DIRECTIONS.has(direction) ? (direction as FlowDirection) : 'TD'
}

export function parseFlowchart(dsl: string): FlowchartGraph {
    const lines = dsl.split(/\r?\n/)
    let direction: FlowDirection | null = null
    const nodes = new Map<string, DiagramNode>()
    const edges: DiagramEdge[] = []

    for (const rawLine of lines) {
        const line = rawLine.trim()
        if (!line || line.startsWith('%%')) continue
        if (/^(?:flowchart|graph)\b/i.test(line)) {
            if (direction) throw new Error('Could not parse flowchart DSL: multiple headers')
            const match = line.match(/^(?:flowchart|graph)\s+(TD|TB|BT|LR|RL)\s*$/i)
            if (!match) throw new Error('Could not parse flowchart DSL: expected "flowchart TD"')
            direction = match[1].toUpperCase() as FlowDirection
            continue
        }
        if (/^subgraph\b/i.test(line) || line === 'end') {
            throw new Error('Could not parse flowchart DSL: subgraph is not supported')
        }
        if (/^(classDef|class|style|click|linkStyle)\b/i.test(line)) continue
        if (!direction) throw new Error('Could not parse flowchart DSL: missing flowchart header')
        parseStatement(line, nodes, edges)
    }

    if (!direction) throw new Error('Could not parse flowchart DSL: missing flowchart header')
    return { direction, nodes: [...nodes.values()], edges }
}

export function serializeFlowchart(graph: FlowchartGraph): string {
    const byId = new Map(graph.nodes.map((node) => [node.id, node]))
    const lines = [`flowchart ${graph.direction}`]
    const used = new Set<string>()
    for (const edge of graph.edges) {
        const source = byId.get(edge.source)
        const target = byId.get(edge.target)
        if (!source || !target) continue
        const operator = edge.label ? `-->|${edge.label}|` : '-->'
        lines.push(`  ${serializeNode(source)} ${operator} ${serializeNode(target)}`)
        used.add(source.id)
        used.add(target.id)
    }
    for (const node of graph.nodes) {
        if (!used.has(node.id)) lines.push(`  ${serializeNode(node)}`)
    }
    return lines.join('\n')
}

export function flowchartsEquivalent(left: string, right: string): boolean {
    const a = parseFlowchart(left)
    const b = parseFlowchart(right)
    if (a.direction !== b.direction) return false
    const nodeKey = (graph: FlowchartGraph) => graph.nodes.map((node) => `${node.id}:${node.data.label}:${node.data.shape}`).join('|')
    const edgeKey = (graph: FlowchartGraph) => graph.edges.map((edge) => `${edge.source}>${edge.target}:${edge.label ?? ''}`).join('|')
    return nodeKey(a) === nodeKey(b) && edgeKey(a) === edgeKey(b)
}

function parseStatement(line: string, nodes: Map<string, DiagramNode>, edges: DiagramEdge[]) {
    const tokens: string[] = []
    const labels: Array<string | undefined> = []
    let rest = stripClass(line)
    while (rest.length) {
        const edge = findNextEdge(rest)
        if (!edge) {
            tokens.push(rest.trim())
            break
        }
        tokens.push(rest.slice(0, edge.index).trim())
        labels.push(edge.label)
        rest = rest.slice(edge.index + edge.length).trim()
    }

    const parsed = tokens.filter(Boolean).map((token) => parseNodeToken(token))
    if (parsed.length === 0) throw new Error(`Could not parse flowchart DSL: ${line}`)
    for (const node of parsed) rememberNode(nodes, node)
    for (let index = 0; index < labels.length; index += 1) {
        const source = parsed[index]
        const target = parsed[index + 1]
        if (!source || !target) throw new Error(`Could not parse flowchart DSL: ${line}`)
        const label = labels[index]
        edges.push(
            cleanEdge({
                id: `e-${source.id}-${target.id}-${edges.length}`,
                source: source.id,
                target: target.id,
                ...(label ? { label } : {})
            })
        )
    }
}

function rememberNode(nodes: Map<string, DiagramNode>, next: DiagramNode) {
    const existing = nodes.get(next.id)
    if (!existing) {
        nodes.set(next.id, next)
        return
    }
    if (existing.data.label === existing.id && next.data.label !== next.id) {
        nodes.set(next.id, { ...existing, data: next.data })
    }
}

function parseNodeToken(token: string): DiagramNode {
    const text = stripClass(token).trim()
    const patterns: Array<{ re: RegExp; shape: string }> = [
        { re: /^([A-Za-z_][\w-]*)\s*\[\[(.+)\]\]$/, shape: 'subroutine' },
        { re: /^([A-Za-z_][\w-]*)\s*\(\((.+)\)\)$/, shape: 'circle' },
        { re: /^([A-Za-z_][\w-]*)\s*\[(.+)\]$/, shape: 'rect' },
        { re: /^([A-Za-z_][\w-]*)\s*\((.+)\)$/, shape: 'round' },
        { re: /^([A-Za-z_][\w-]*)\s*\{(.+)\}$/, shape: 'diamond' },
        { re: /^([A-Za-z_][\w-]*)\s*>(.+)\]$/, shape: 'flag' },
        { re: /^([A-Za-z_][\w-]*)$/, shape: 'rect' }
    ]
    for (const pattern of patterns) {
        const match = text.match(pattern.re)
        if (!match) continue
        const id = match[1]
        const rawLabel = match[2] ?? id
        return cleanNode({
            id,
            type: 'flowchart',
            position: { x: 0, y: 0 },
            data: { label: unwrapLabel(rawLabel), shape: pattern.shape }
        })
    }
    throw new Error(`Could not parse flowchart DSL: node "${token}"`)
}

function serializeNode(node: DiagramNode): string {
    const label = escapeLabel(node.data.label || node.id)
    switch (node.data.shape) {
        case 'round':
            return `${node.id}(${label})`
        case 'circle':
            return `${node.id}((${label}))`
        case 'diamond':
            return `${node.id}{${label}}`
        case 'subroutine':
            return `${node.id}[[${label}]]`
        case 'flag':
            return `${node.id}>${label}]`
        default:
            return `${node.id}[${label}]`
    }
}

function escapeLabel(label: string): string {
    if (/[[\]{}()"|<>]/.test(label)) return `"${label.replaceAll('"', '#quot;')}"`
    return label
}

function unwrapLabel(label: string): string {
    const trimmed = label.trim()
    if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
        return trimmed.slice(1, -1).replaceAll('#quot;', '"')
    }
    return trimmed
}

function stripClass(value: string): string {
    return value.replace(/:::[A-Za-z_][\w-]*/g, '').trim()
}

function findNextEdge(input: string): { index: number; length: number; label?: string } | null {
    const matchers = [
        /\s+--\s+(.+?)\s+-->\s*/,
        /\s*-->\s*\|([^|]*)\|\s*/,
        /\s*-\.->\s*\|([^|]*)\|\s*/,
        /\s*==>\s*\|([^|]*)\|\s*/,
        /\s*---\s*\|([^|]*)\|\s*/,
        /\s*-->\s*/,
        /\s*-\.->\s*/,
        /\s*==>\s*/,
        /\s*---\s*/
    ]
    let best: { index: number; length: number; label?: string } | null = null
    for (const matcher of matchers) {
        const match = matcher.exec(input)
        if (!match || match.index < 0) continue
        if (best && match.index >= best.index) continue
        const label = match[1]?.trim()
        best = { index: match.index, length: match[0].length, ...(label ? { label } : {}) }
    }
    return best
}
