import { describe, expect, it } from 'vitest'
import { emptyFlowchartDocument } from '../schema'
import { exportFigmaSvg, listFigmaLayerNames } from './figmaSvg'

describe('Figma SVG layers', () => {
    it('names layers for a two-node flowchart', () => {
        const document = {
            ...emptyFlowchartDocument(),
            dsl: 'flowchart TD\n  A[Start] --> B[End]',
            nodes: [
                { id: 'A', type: 'flowchart', position: { x: 40, y: 40 }, data: { label: 'Start', shape: 'rect' } },
                { id: 'B', type: 'flowchart', position: { x: 40, y: 160 }, data: { label: 'End', shape: 'rect' } }
            ],
            edges: [{ id: 'e-A-B', source: 'A', target: 'B' }]
        }
        const svg = exportFigmaSvg(document)
        const layers = listFigmaLayerNames(svg)
        expect(layers).toEqual(expect.arrayContaining(['Background', 'Edges', 'Nodes', 'node-A', 'node-B', 'edge-A-B']))
        expect(svg).toContain('data-name="node-A"')
        expect(svg).toContain('data-name="node-B"')
        expect(svg).not.toContain('api.figma.com')
    })
})
