import type { DiagramDocument, DiagramEdge, DiagramFamily, DiagramNode } from '../schema'

export type FamilyGraph = {
    nodes: DiagramNode[]
    edges: DiagramEdge[]
    dsl: string
}

export type DiagramFamilyModule = {
    id: DiagramFamily
    label: string
    /** Picture families edit on XYFlow. Agent waits for Wave 7. */
    editable: boolean
    /** When true, the DSL panel parses/serializes. Otherwise canvas edits keep the prior dsl string. */
    hasDslRoundTrip: boolean
    emptyDocument: () => DiagramDocument
    parseDsl: (dsl: string) => FamilyGraph
    serialize: (nodes: DiagramNode[], edges: DiagramEdge[], previousDsl?: string) => string
    defaultNodeLabel: (index: number) => string
}
