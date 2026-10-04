import { emptyFlowchartDocument, type DiagramEdge, type DiagramNode } from '../schema'
import { parseFlowchart, readDirection, serializeFlowchart } from '../mermaid/flowchart'
import type { DiagramFamilyModule, FamilyGraph } from './types'

function parseDsl(dsl: string): FamilyGraph {
    const parsed = parseFlowchart(dsl)
    return { nodes: parsed.nodes, edges: parsed.edges, dsl: dsl.trimEnd() }
}

function serialize(nodes: DiagramNode[], edges: DiagramEdge[], previousDsl?: string): string {
    return serializeFlowchart({
        direction: readDirection(previousDsl || 'flowchart TD'),
        nodes,
        edges
    })
}

export const flowchartFamily: DiagramFamilyModule = {
    id: 'flowchart',
    label: 'Flowchart',
    editable: true,
    hasDslRoundTrip: true,
    emptyDocument: emptyFlowchartDocument,
    parseDsl,
    serialize,
    defaultNodeLabel: (index) => `Step ${index}`
}
