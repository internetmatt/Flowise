import { describe, expect, it } from 'vitest'
import { emptyFlowchartDocument } from '../schema'
import { exportJson, exportSvg } from './exportDiagram'

describe('client export', () => {
    it('writes SVG and the v1 JSON blob without a server', () => {
        const document = {
            ...emptyFlowchartDocument(),
            dsl: 'flowchart TD\n  A[Start] --> B[End]',
            nodes: [
                { id: 'A', type: 'flowchart', position: { x: 40, y: 40 }, data: { label: 'Start', shape: 'rect' } },
                { id: 'B', type: 'flowchart', position: { x: 40, y: 160 }, data: { label: 'End', shape: 'rect' } }
            ],
            edges: [{ id: 'e-A-B', source: 'A', target: 'B' }]
        }
        expect(exportSvg(document)).toContain('>Start<')
        expect(exportSvg(document)).toContain('>End<')
        expect(JSON.parse(exportJson(document)).schema).toBe('ideaflow-diagram/v1')
    })
})
