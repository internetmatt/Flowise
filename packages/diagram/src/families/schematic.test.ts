import { describe, expect, it } from 'vitest'
import { parseDiagramDocument } from '../schema'
import { schematicFamily } from './schematic'

describe('schematic family', () => {
    it('parses schematic DSL', () => {
        const parsed = schematicFamily.parseDsl('schematic\nSupply --> Load')
        expect(parsed.nodes.map((node) => node.id)).toEqual(['Supply', 'Load'])
        expect(parsed.edges[0]).toMatchObject({ source: 'Supply', target: 'Load' })
    })

    it('round-trips through the v1 blob', () => {
        const document = parseDiagramDocument(
            JSON.stringify({
                schema: 'ideaflow-diagram/v1',
                family: 'schematic',
                dsl: 'schematic\nSupply --> Load',
                nodes: [
                    { id: 'Supply', position: { x: 0, y: 0 }, data: { label: 'Supply' } },
                    { id: 'Load', position: { x: 0, y: 0 }, data: { label: 'Load' } }
                ],
                edges: [{ id: 'e1', source: 'Supply', target: 'Load' }],
                viewport: { x: 0, y: 0, zoom: 1 }
            })
        )
        expect(document.family).toBe('schematic')
        expect(schematicFamily.serialize(document.nodes, document.edges)).toContain('Supply')
    })
})
