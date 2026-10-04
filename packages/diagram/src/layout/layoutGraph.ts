import ELK from 'elkjs/lib/elk.bundled.js'
import type { ElkGraph } from './elk'

const elk = new ELK()

export function layoutGraph(graph: ElkGraph) {
    return elk.layout(graph)
}
