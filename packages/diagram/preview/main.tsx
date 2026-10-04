import { createRoot } from 'react-dom/client'
import { DiagramStudio } from '../src/studio/DiagramStudio'
import '@xyflow/react/dist/style.css'
import '../src/studio/studio.css'

const flow = {
    schema: 'ideaflow-diagram/v1',
    family: 'flowchart',
    dsl: 'flowchart TD\n  A[Start] --> B[End]',
    nodes: [
        { id: 'A', type: 'flowchart', position: { x: 120, y: 48 }, data: { label: 'Start', shape: 'rect' } },
        { id: 'B', type: 'flowchart', position: { x: 120, y: 200 }, data: { label: 'End', shape: 'rect' } }
    ],
    edges: [{ id: 'A-B', source: 'A', target: 'B' }],
    viewport: { x: 0, y: 0, zoom: 1 }
}

createRoot(document.getElementById('root')!).render(<DiagramStudio flowData={JSON.stringify(flow)} assetBase='/diagram-studio' />)
