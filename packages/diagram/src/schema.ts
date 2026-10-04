export const DIAGRAM_SCHEMA = 'ideaflow-diagram/v1' as const

export const DIAGRAM_FAMILIES = [
    'flowchart',
    'architecture',
    'er',
    'class',
    'sequence',
    'state',
    'mindmap',
    'journey',
    'schematic',
    'agent'
] as const

export type DiagramFamily = (typeof DIAGRAM_FAMILIES)[number]

export type DiagramViewport = { x: number; y: number; zoom: number }

/** Picture nodes use label/shape. Agent nodes also carry the agentflow component payload (`name`, `inputs`, …). */
export type DiagramNodeData = {
    label: string
    shape?: string
    name?: string
    inputs?: Record<string, unknown>
    category?: string
    [key: string]: unknown
}

export type DiagramNode = {
    id: string
    type?: string
    position: { x: number; y: number }
    data: DiagramNodeData
    width?: number
    height?: number
    selected?: boolean
}

export type DiagramEdge = {
    id: string
    source: string
    target: string
    label?: string
}

export type DiagramDocument = {
    schema: typeof DIAGRAM_SCHEMA
    family: DiagramFamily
    dsl: string
    nodes: DiagramNode[]
    edges: DiagramEdge[]
    viewport: DiagramViewport
}

export function emptyFlowchartDocument(): DiagramDocument {
    return {
        schema: DIAGRAM_SCHEMA,
        family: 'flowchart',
        dsl: 'flowchart TD\n',
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
    }
}

export function isDiagramFamily(value: unknown): value is DiagramFamily {
    return typeof value === 'string' && (DIAGRAM_FAMILIES as readonly string[]).includes(value)
}

export function parseDiagramDocument(flowData: string | undefined | null): DiagramDocument {
    if (!flowData || !flowData.trim()) return emptyFlowchartDocument()
    let parsed: unknown
    try {
        parsed = JSON.parse(flowData)
    } catch {
        throw new Error('flowData is not JSON')
    }
    if (!parsed || typeof parsed !== 'object') return emptyFlowchartDocument()
    const record = parsed as Partial<DiagramDocument>
    if (record.schema !== DIAGRAM_SCHEMA) {
        if (Object.keys(record).length === 0) return emptyFlowchartDocument()
        throw new Error(`Unsupported diagram schema: ${String(record.schema)}`)
    }
    if (!isDiagramFamily(record.family)) {
        throw new Error(`Unknown diagram family: ${String(record.family)}`)
    }
    return {
        schema: DIAGRAM_SCHEMA,
        family: record.family,
        dsl: typeof record.dsl === 'string' ? record.dsl : '',
        nodes: Array.isArray(record.nodes) ? record.nodes.map(cleanNode) : [],
        edges: Array.isArray(record.edges) ? record.edges.map(cleanEdge) : [],
        viewport: normalizeViewport(record.viewport)
    }
}

export function serializeDocument(document: DiagramDocument): string {
    return JSON.stringify({
        schema: DIAGRAM_SCHEMA,
        family: document.family,
        dsl: document.dsl,
        nodes: document.nodes.map(cleanNode),
        edges: document.edges.map(cleanEdge),
        viewport: normalizeViewport(document.viewport)
    })
}

export function normalizeViewport(value: unknown): DiagramViewport {
    const viewport = (value ?? {}) as Partial<DiagramViewport>
    return {
        x: typeof viewport.x === 'number' ? viewport.x : 0,
        y: typeof viewport.y === 'number' ? viewport.y : 0,
        zoom: typeof viewport.zoom === 'number' ? viewport.zoom : 1
    }
}

export function cleanNode(node: DiagramNode): DiagramNode {
    const data = { ...(node.data || {}) }
    return {
        id: node.id,
        type: node.type || 'flowchart',
        position: {
            x: node.position?.x ?? 0,
            y: node.position?.y ?? 0
        },
        data: {
            ...data,
            label: typeof data.label === 'string' ? data.label : node.id,
            shape: typeof data.shape === 'string' ? data.shape : 'rect'
        },
        ...(typeof node.width === 'number' ? { width: node.width } : {}),
        ...(typeof node.height === 'number' ? { height: node.height } : {})
    }
}

export function cleanEdge(edge: DiagramEdge): DiagramEdge {
    return {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        ...(typeof edge.label === 'string' && edge.label ? { label: edge.label } : {})
    }
}
