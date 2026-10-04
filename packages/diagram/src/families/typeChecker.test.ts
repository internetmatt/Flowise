import { describe, expect, it } from 'vitest'
import { runTypeChecker, type SchematicBook } from './typeChecker'

const book: SchematicBook = {
    id: 'studio-schematic',
    requireNodes: ['Supply', 'Load'],
    requireEdges: [{ source: 'Supply', target: 'Load' }]
}

describe('schematic type-checker', () => {
    it('fails when the connector has no book', () => {
        const result = runTypeChecker(
            [{ id: 'Check', position: { x: 0, y: 0 }, data: { label: 'Check', role: 'type-checker' } }],
            [],
            [book]
        )
        expect(result.pass).toBe(false)
        expect(result.failures).toEqual(['book unnamed'])
    })

    it('reports pass for a named book whose parts are present', () => {
        const result = runTypeChecker(
            [
                { id: 'Supply', position: { x: 0, y: 0 }, data: { label: 'Supply' } },
                { id: 'Load', position: { x: 0, y: 0 }, data: { label: 'Load' } },
                { id: 'Check', position: { x: 0, y: 0 }, data: { label: 'Check', role: 'type-checker', book: 'studio-schematic' } }
            ],
            [{ id: 'e1', source: 'Supply', target: 'Load' }],
            [book]
        )
        expect(result).toEqual({ book: 'studio-schematic', pass: true, failures: [] })
    })

    it('reports fail for a named book when a required edge is missing', () => {
        const result = runTypeChecker(
            [
                { id: 'Supply', position: { x: 0, y: 0 }, data: { label: 'Supply' } },
                { id: 'Load', position: { x: 0, y: 0 }, data: { label: 'Load' } },
                { id: 'Check', position: { x: 0, y: 0 }, data: { label: 'Check', role: 'type-checker', book: 'studio-schematic' } }
            ],
            [],
            [book]
        )
        expect(result.book).toBe('studio-schematic')
        expect(result.pass).toBe(false)
        expect(result.failures).toContain('missing edge Supply->Load')
    })
})
