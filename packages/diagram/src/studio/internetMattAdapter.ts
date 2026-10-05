import type { DiagramEdge, DiagramNode, DiagramViewport } from '../schema'
import type { FlowGraph } from '../vendor/flow-canvas/core/types'

/** The canvas is a projection; original IdeaFlow payloads stay authoritative. */
export function toInternetMattGraph(nodes: DiagramNode[], edges: DiagramEdge[], viewport: DiagramViewport): FlowGraph {
    return {
        nodes: nodes.map((node) => ({ ...node, label: node.data.label, data: { ...node.data } })),
        edges: edges.map((edge) => ({ ...edge })),
        viewport: { ...viewport }
    }
}

export function fromInternetMattGraph(graph: FlowGraph, originalNodes: DiagramNode[], originalEdges: DiagramEdge[]) {
    const originals = new Map(originalNodes.map((node) => [node.id, node]))
    const edgeOriginals = new Map(originalEdges.map((edge) => [edge.id, edge]))
    return {
        nodes: graph.nodes.map((node): DiagramNode => {
            const original = originals.get(node.id)
            return {
                ...original,
                id: node.id,
                type: original?.type ?? 'flowchart',
                position: { ...node.position },
                data: { ...original?.data, label: node.label ?? original?.data.label ?? node.id },
                selected: node.selected ?? false
            }
        }),
        edges: graph.edges.map(
            (edge): DiagramEdge => ({
                ...edgeOriginals.get(edge.id),
                id: edge.id,
                source: edge.source,
                target: edge.target,
                ...(edge.label !== undefined ? { label: edge.label } : {})
            })
        ),
        viewport: graph.viewport ? { ...graph.viewport } : { x: 0, y: 0, zoom: 1 }
    }
}
