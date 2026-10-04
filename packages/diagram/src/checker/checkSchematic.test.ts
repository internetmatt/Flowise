import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDiagramDocument } from '../schema'
import { checkSchematic, parseBook } from './checkSchematic'

const book = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'ideaflow-parts-v1.json'), 'utf8'))

describe('schematic type-checker', () => {
    it('names the fixture book', () => {
        expect(parseBook(book).id).toBe('ideaflow-parts-v1')
    })

    it('refuses an unnamed book', () => {
        expect(() => parseBook({ schema: 'ideaflow-schematic-book/v1', id: '', parts: {} })).toThrow('book is unnamed')
    })

    it('passes the docs-and-spots schematic against ideaflow-parts-v1', () => {
        const document = parseDiagramDocument(
            JSON.stringify({
                schema: 'ideaflow-diagram/v1',
                family: 'schematic',
                dsl: 'schematic\nRecords --> Skill\nSkill --> Svg\nSkill --> Spots',
                nodes: [
                    { id: 'Records', position: { x: 0, y: 0 }, data: { label: 'Records' } },
                    { id: 'Skill', position: { x: 0, y: 0 }, data: { label: 'Skill' } },
                    { id: 'Svg', position: { x: 0, y: 0 }, data: { label: 'Svg' } },
                    { id: 'Spots', position: { x: 0, y: 0 }, data: { label: 'Spots' } }
                ],
                edges: [
                    { id: 'e1', source: 'Records', target: 'Skill' },
                    { id: 'e2', source: 'Skill', target: 'Svg' },
                    { id: 'e3', source: 'Skill', target: 'Spots' }
                ],
                viewport: { x: 0, y: 0, zoom: 1 }
            })
        )
        const result = checkSchematic(document, book)
        expect(result).toEqual({ pass: true, book: 'ideaflow-parts-v1', failures: [] })
    })

    it('fails an unknown part', () => {
        const document = parseDiagramDocument(
            JSON.stringify({
                schema: 'ideaflow-diagram/v1',
                family: 'schematic',
                dsl: 'schematic\nMystery --> Load',
                nodes: [
                    { id: 'Mystery', position: { x: 0, y: 0 }, data: { label: 'Mystery' } },
                    { id: 'Load', position: { x: 0, y: 0 }, data: { label: 'Load' } }
                ],
                edges: [{ id: 'e1', source: 'Mystery', target: 'Load' }],
                viewport: { x: 0, y: 0, zoom: 1 }
            })
        )
        const result = checkSchematic(document, book)
        expect(result.pass).toBe(false)
        expect(result.failures).toContain('unknown part Mystery')
    })
})
