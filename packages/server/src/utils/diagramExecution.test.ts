import { StatusCodes } from 'http-status-codes'
import { assertDiagramPredictionAllowed, DIAGRAM_SCHEMA } from './diagramExecution'

const diagram = (family: string) =>
    JSON.stringify({
        schema: DIAGRAM_SCHEMA,
        family,
        dsl: 'flowchart TD\n  A --> B',
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
    })

describe('buildChatflow DIAGRAM prediction', () => {
    it.each(['flowchart', 'architecture', 'er', 'class', 'sequence', 'state', 'mindmap', 'journey'])(
        'rejects a DIAGRAM whose family is %s',
        (family) => {
            expect(() => assertDiagramPredictionAllowed({ type: 'DIAGRAM', flowData: diagram(family) })).toThrow(/family ".*" is not agent/)
            try {
                assertDiagramPredictionAllowed({ type: 'DIAGRAM', flowData: diagram(family) })
            } catch (error) {
                expect(error).toMatchObject({ statusCode: StatusCodes.BAD_REQUEST })
            }
        }
    )

    it('rejects a DIAGRAM with no agent family', () => {
        expect(() => assertDiagramPredictionAllowed({ type: 'DIAGRAM', flowData: '{not json' })).toThrow(/is not agent/)
        expect(() => assertDiagramPredictionAllowed({ type: 'DIAGRAM', flowData: JSON.stringify({ nodes: [] }) })).toThrow(/is not agent/)
    })

    it('does not refuse family agent or a non-DIAGRAM chatflow', () => {
        expect(() => assertDiagramPredictionAllowed({ type: 'DIAGRAM', flowData: diagram('agent') })).not.toThrow()
        expect(() => assertDiagramPredictionAllowed({ type: 'CHATFLOW', flowData: diagram('flowchart') })).not.toThrow()
    })
})
