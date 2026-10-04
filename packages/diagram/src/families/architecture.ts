import { DIAGRAM_SCHEMA, type DiagramDocument, type DiagramEdge, type DiagramNode } from '../schema'
import { parseBoxStatements, serializeBoxStatements } from './boxGraph'
import type { DiagramFamilyModule, FamilyGraph } from './types'

const HEADER = 'architecture'

function empty(): DiagramDocument {
    return {
        schema: DIAGRAM_SCHEMA,
        family: 'architecture',
        dsl: `${HEADER}\n`,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
    }
}

function parseDsl(dsl: string): FamilyGraph {
    const { nodes, edges } = parseBoxStatements(dsl.split(/\r?\n/), {
        nodeType: 'architecture',
        requireHeader: /^architecture\b/i,
        headerError: 'Could not parse architecture DSL: expected "architecture" header'
    })
    return { nodes, edges, dsl: dsl.trimEnd() }
}

function serialize(nodes: DiagramNode[], edges: DiagramEdge[]): string {
    return serializeBoxStatements(nodes, edges, HEADER)
}

export const architectureFamily: DiagramFamilyModule = {
    id: 'architecture',
    label: 'Architecture',
    editable: true,
    hasDslRoundTrip: true,
    emptyDocument: empty,
    parseDsl,
    serialize,
    defaultNodeLabel: (index) => `Component ${index}`
}
