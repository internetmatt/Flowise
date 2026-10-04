import { cleanEdge, cleanNode, type DiagramEdge, type DiagramNode } from '../schema'

/** Shared box → box statement parser used by architecture and similar simple graphs. */
export function parseBoxStatements(
    lines: string[],
    options: { nodeType: string; defaultShape?: string; requireHeader?: RegExp; headerError: string }
): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
    const nodes = new Map<string, DiagramNode>()
    const edges: DiagramEdge[] = []
    let sawHeader = !options.requireHeader

    for (const raw of lines) {
        const line = raw.trim()
        if (!line || line.startsWith('%%') || line.startsWith('#')) continue
        if (options.requireHeader?.test(line)) {
            sawHeader = true
            continue
        }
        if (!sawHeader) throw new Error(options.headerError)
        const edge = line.match(/^([A-Za-z_][\w-]*)(?:\[([^\]]*)\])?\s*-->\s*([A-Za-z_][\w-]*)(?:\[([^\]]*)\])?(?:\s*:\s*(.+))?$/)
        if (edge) {
            remember(nodes, edge[1], edge[2], options.nodeType, options.defaultShape)
            remember(nodes, edge[3], edge[4], options.nodeType, options.defaultShape)
            edges.push(
                cleanEdge({
                    id: `e-${edge[1]}-${edge[3]}-${edges.length}`,
                    source: edge[1],
                    target: edge[3],
                    ...(edge[5]?.trim() ? { label: edge[5].trim() } : {})
                })
            )
            continue
        }
        const alone = line.match(/^([A-Za-z_][\w-]*)(?:\[([^\]]*)\])?$/)
        if (alone) {
            remember(nodes, alone[1], alone[2], options.nodeType, options.defaultShape)
            continue
        }
        throw new Error(`Could not parse ${options.nodeType} DSL: ${line}`)
    }

    if (!sawHeader) throw new Error(options.headerError)
    return { nodes: [...nodes.values()], edges }
}

export function serializeBoxStatements(nodes: DiagramNode[], edges: DiagramEdge[], header: string): string {
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const lines = [header]
    const used = new Set<string>()
    for (const edge of edges) {
        const source = byId.get(edge.source)
        const target = byId.get(edge.target)
        if (!source || !target) continue
        const label = edge.label ? ` : ${edge.label}` : ''
        lines.push(`  ${boxToken(source)} --> ${boxToken(target)}${label}`)
        used.add(source.id)
        used.add(target.id)
    }
    for (const node of nodes) {
        if (!used.has(node.id)) lines.push(`  ${boxToken(node)}`)
    }
    return lines.join('\n')
}

function boxToken(node: DiagramNode): string {
    const label = node.data.label || node.id
    return label === node.id ? node.id : `${node.id}[${escapeBracket(label)}]`
}

function remember(nodes: Map<string, DiagramNode>, id: string, label: string | undefined, nodeType: string, defaultShape = 'rect') {
    const next = cleanNode({
        id,
        type: nodeType,
        position: { x: 0, y: 0 },
        data: { label: label?.trim() || id, shape: defaultShape }
    })
    const existing = nodes.get(id)
    if (!existing || (existing.data.label === existing.id && next.data.label !== next.id)) {
        nodes.set(id, next)
    }
}

function escapeBracket(label: string): string {
    return label.replaceAll(']', '')
}
