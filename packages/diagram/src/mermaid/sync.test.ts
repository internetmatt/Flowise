import { describe, expect, it } from 'vitest'
import { documentFromCanvas, tryApplyDsl } from '../document'
import { emptyFlowchartDocument } from '../schema'
import { parseFlowchart } from './flowchart'

describe('canvas and dsl stay in sync', () => {
    it('rewrites dsl from the canvas and nodes from dsl', () => {
        const parsed = parseFlowchart('flowchart TD\n  A[Start] --> B[Process]')
        const current = {
            ...emptyFlowchartDocument(),
            dsl: 'flowchart TD\n  A[Start] --> B[Process]',
            nodes: parsed.nodes,
            edges: parsed.edges
        }
        const renamed = current.nodes.map((node) => (node.id === 'B' ? { ...node, data: { ...node.data, label: 'Review' } } : node))
        const fromCanvas = documentFromCanvas(current, renamed, current.edges)
        expect(fromCanvas.dsl).toContain('B[Review]')

        const fromDsl = tryApplyDsl(fromCanvas, 'flowchart LR\n  A[Start] --> C[End]')
        expect(fromDsl.error).toBeNull()
        expect(fromDsl.document.nodes.map((node) => node.id)).toEqual(['A', 'C'])
        expect(fromDsl.document.edges.map((edge) => [edge.source, edge.target])).toEqual([['A', 'C']])
        expect(fromDsl.document.dsl).toContain('flowchart LR')

        const rejected = tryApplyDsl(fromCanvas, 'not a diagram')
        expect(rejected.error).toBeTruthy()
        expect(rejected.document).toBe(fromCanvas)
    })
})
