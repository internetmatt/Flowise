import type { ConnectionDraft, FlowEdge, FlowGraph, FlowNode, FlowStoreListener, Viewport } from './types.ts'
import { DEFAULT_VIEWPORT } from './types.ts'

export interface FlowStore {
    getSnapshot(): FlowGraph & {
        selection: Set<string>
        connection: ConnectionDraft | null
    }
    getNodes(): FlowNode[]
    getEdges(): FlowEdge[]
    getViewport(): Viewport
    getSelection(): Set<string>
    getConnection(): ConnectionDraft | null
    setGraph(graph: FlowGraph): void
    setViewport(viewport: Viewport): void
    setNodes(nodes: FlowNode[]): void
    setEdges(edges: FlowEdge[]): void
    updateNode(id: string, patch: Partial<FlowNode>): void
    addNode(node: FlowNode): void
    removeNodes(ids: string[]): void
    addEdge(edge: FlowEdge): void
    removeEdges(ids: string[]): void
    select(ids: string[], additive?: boolean): void
    clearSelection(): void
    setConnection(draft: ConnectionDraft | null): void
    subscribe(listener: FlowStoreListener): () => void
    toJSON(): FlowGraph
}

export function createFlowStore(initial?: Partial<FlowGraph>): FlowStore {
    let nodes: FlowNode[] = initial?.nodes ? structuredClone(initial.nodes) : []
    let edges: FlowEdge[] = initial?.edges ? structuredClone(initial.edges) : []
    let viewport: Viewport = { ...(initial?.viewport ?? DEFAULT_VIEWPORT) }
    let selection = new Set<string>()
    let connection: ConnectionDraft | null = null
    const listeners = new Set<FlowStoreListener>()

    const emit = (): void => {
        for (const l of listeners) l()
    }

    return {
        getSnapshot() {
            return {
                nodes,
                edges,
                viewport,
                selection: new Set(selection),
                connection
            }
        },
        getNodes: () => nodes,
        getEdges: () => edges,
        getViewport: () => viewport,
        getSelection: () => selection,
        getConnection: () => connection,

        setGraph(graph) {
            nodes = structuredClone(graph.nodes)
            edges = structuredClone(graph.edges)
            if (graph.viewport) viewport = { ...graph.viewport }
            selection = new Set()
            connection = null
            emit()
        },

        setViewport(next) {
            viewport = { ...next }
            emit()
        },

        setNodes(next) {
            nodes = structuredClone(next)
            emit()
        },

        setEdges(next) {
            edges = structuredClone(next)
            emit()
        },

        updateNode(id, patch) {
            nodes = nodes.map((n) => (n.id === id ? { ...n, ...patch, position: patch.position ? { ...patch.position } : n.position } : n))
            emit()
        },

        addNode(node) {
            nodes = [...nodes, structuredClone(node)]
            emit()
        },

        removeNodes(ids) {
            const drop = new Set(ids)
            nodes = nodes.filter((n) => !drop.has(n.id))
            edges = edges.filter((e) => !drop.has(e.source) && !drop.has(e.target))
            for (const id of ids) selection.delete(id)
            emit()
        },

        addEdge(edge) {
            if (edges.some((e) => e.id === edge.id)) return
            edges = [...edges, structuredClone(edge)]
            emit()
        },

        removeEdges(ids) {
            const drop = new Set(ids)
            edges = edges.filter((e) => !drop.has(e.id))
            emit()
        },

        select(ids, additive = false) {
            if (!additive) selection = new Set(ids)
            else for (const id of ids) selection.add(id)
            nodes = nodes.map((n) => ({ ...n, selected: selection.has(n.id) }))
            edges = edges.map((e) => ({ ...e, selected: selection.has(e.id) }))
            emit()
        },

        clearSelection() {
            selection = new Set()
            nodes = nodes.map((n) => ({ ...n, selected: false }))
            edges = edges.map((e) => ({ ...e, selected: false }))
            emit()
        },

        setConnection(draft) {
            connection = draft ? structuredClone(draft) : null
            emit()
        },

        subscribe(listener) {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },

        toJSON() {
            return {
                nodes: structuredClone(nodes),
                edges: structuredClone(edges),
                viewport: { ...viewport }
            }
        }
    }
}
