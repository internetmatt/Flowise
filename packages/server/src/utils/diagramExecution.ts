import { StatusCodes } from 'http-status-codes'
import { InternalFlowiseError } from '../errors/internalFlowiseError'

export const DIAGRAM_SCHEMA = 'ideaflow-diagram/v1'

/**
 * Picture families are documents. Only family "agent" may proceed toward the executor.
 */
export function assertDiagramPredictionAllowed(chatflow: { type?: string; flowData?: string }): void {
    if (chatflow.type !== 'DIAGRAM') return

    const family = readDiagramFamily(chatflow.flowData)
    if (family === 'agent') return

    throw new InternalFlowiseError(StatusCodes.BAD_REQUEST, `DIAGRAM prediction refused: family "${family ?? 'unknown'}" is not agent`)
}

export function readDiagramFamily(flowData: string | undefined): string | undefined {
    if (!flowData) return undefined
    try {
        const parsed = JSON.parse(flowData) as { schema?: unknown; family?: unknown }
        if (parsed?.schema !== DIAGRAM_SCHEMA || typeof parsed.family !== 'string' || !parsed.family) return undefined
        return parsed.family
    } catch {
        return undefined
    }
}

/**
 * Agent-family v1 blobs store component nodes inside the document.
 * The existing executor still reads a React Flow `{ nodes, edges }` graph.
 */
export function agentExecutorFlowData(flowData: string | undefined): string {
    if (!flowData) return flowData || ''
    try {
        const parsed = JSON.parse(flowData) as {
            schema?: unknown
            family?: unknown
            nodes?: unknown
            edges?: unknown
            viewport?: unknown
        }
        if (parsed?.schema === DIAGRAM_SCHEMA && parsed.family === 'agent') {
            return JSON.stringify({
                nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
                edges: Array.isArray(parsed.edges) ? parsed.edges : [],
                viewport: parsed.viewport
            })
        }
    } catch {
        return flowData
    }
    return flowData
}

export function isAgentDiagram(chatflow: { type?: string; flowData?: string }): boolean {
    return chatflow.type === 'DIAGRAM' && readDiagramFamily(chatflow.flowData) === 'agent'
}
