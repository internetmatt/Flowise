import { describe, expect, it } from 'vitest'
import { parseDiagramDocument, serializeDocument } from '../schema'
import { flowchartsEquivalent, parseFlowchart, serializeFlowchart } from './flowchart'

const FIXTURE = `flowchart TD
  A[Start] --> B[Process]
  B --> C[End]
`

describe('flowchart mermaid round-trip', () => {
    it('parses a flowchart onto nodes and edges and serializes equivalent mermaid', () => {
        const parsed = parseFlowchart(FIXTURE)
        expect(parsed.direction).toBe('TD')
        expect(parsed.nodes.map((node) => [node.id, node.data.label])).toEqual([
            ['A', 'Start'],
            ['B', 'Process'],
            ['C', 'End']
        ])
        expect(parsed.edges.map((edge) => [edge.source, edge.target])).toEqual([
            ['A', 'B'],
            ['B', 'C']
        ])

        const serialized = serializeFlowchart(parsed)
        expect(flowchartsEquivalent(FIXTURE, serialized)).toBe(true)
        const again = parseFlowchart(serialized)
        expect(again.nodes.map((node) => node.data.label)).toEqual(['Start', 'Process', 'End'])
        expect(again.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual(['A->B', 'B->C'])
    })
})

describe('ideaflow-diagram/v1', () => {
    it('restores family, dsl, nodes, edges, and viewport', () => {
        const raw = JSON.stringify({
            schema: 'ideaflow-diagram/v1',
            family: 'flowchart',
            dsl: FIXTURE.trim(),
            nodes: [{ id: 'A', position: { x: 12, y: 24 }, data: { label: 'Start', shape: 'rect' }, type: 'flowchart' }],
            edges: [{ id: 'e-A-B-0', source: 'A', target: 'B' }],
            viewport: { x: 3, y: 4, zoom: 1.25 }
        })
        const document = parseDiagramDocument(raw)
        expect(document.family).toBe('flowchart')
        expect(document.dsl).toContain('A[Start]')
        expect(document.nodes[0]?.position).toEqual({ x: 12, y: 24 })
        expect(document.edges[0]).toMatchObject({ source: 'A', target: 'B' })
        expect(document.viewport).toEqual({ x: 3, y: 4, zoom: 1.25 })
        const saved = parseDiagramDocument(serializeDocument(document))
        expect(saved).toEqual(document)
    })
})
