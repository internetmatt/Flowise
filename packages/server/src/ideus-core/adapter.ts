/**
 * Ideus / AskDilly-Core schema adapter for OpenIdeas.
 *
 * AskDilly-Core (`wt-flowise-replacement`) stores a pointer on workflow.meta:
 *   { engine: 'flowise', externalFlowId: '<chatflow-or-agentflow-id>' }
 * and proxies `/rest/flowise/*` to `${IDEUS_FLOWISE_BASE_URL}/api/v1/*`.
 *
 * Point `IDEUS_FLOWISE_BASE_URL` at this OpenIdeas instance (default :3010)
 * instead of stock `flowiseai/flowise`. Keep `IDEUS_FLOWISE_API_KEY` server-side.
 *
 * Product name is OpenIdeas. `engine: 'flowise'` stays in Core meta until a
 * dedicated rename PR — changing it here would break the canvas island.
 */

/** Ideus sibling port. Avoids Marketing UI :3005, Ideas :3011, Grafana :3000. */
export const IDEUS_OPENIDEAS_DEFAULT_PORT = 3010

export const IDEUS_OPENIDEAS_DEFAULT_BASE_URL = `http://localhost:${IDEUS_OPENIDEAS_DEFAULT_PORT}`

/** Core still uses `flowise` in workflow.meta until a dedicated rename PR. */
export type CoreWorkflowEngineId = 'n8n' | 'flowise'

export type CoreWorkflowMetaPointer = {
    engine?: CoreWorkflowEngineId
    externalFlowId?: string
}

export type OpenIdeasFlowPointer = {
    engine: 'flowise'
    externalFlowId: string
    /** OpenIdeas chatflow / agentflow id — same value as Core `externalFlowId`. */
    chatflowId: string
}

export type OpenIdeasChatflowType = 'CHATFLOW' | 'MULTIAGENT' | 'ASSISTANT' | 'AGENTFLOW'

/** Minimal Core Chat Hub session fields needed to open an OpenIdeas predict chat. */
export type CoreChatHubSessionPointer = {
    id: string
    title: string
    workflowId: string | null
    agentId: string | null
}

export type OpenIdeasChatSessionPointer = {
    chatId: string
    chatflowId: string | null
}

export function openIdeasPointerFromWorkflowMeta(meta: CoreWorkflowMetaPointer | null | undefined): OpenIdeasFlowPointer | null {
    if (meta?.engine !== 'flowise' || !meta.externalFlowId?.trim()) {
        return null
    }
    const id = meta.externalFlowId.trim()
    return {
        engine: 'flowise',
        externalFlowId: id,
        chatflowId: id
    }
}

export function chatflowApiPath(chatflowId: string): string {
    return `/api/v1/chatflows/${encodeURIComponent(chatflowId)}`
}

export function predictionApiPath(chatflowId: string): string {
    return `/api/v1/prediction/${encodeURIComponent(chatflowId)}`
}

export function executionsQueryPath(agentflowId: string): string {
    return `/api/v1/executions?agentflowId=${encodeURIComponent(agentflowId)}`
}

/**
 * Map a Core Chat Hub session onto an OpenIdeas predict `chatId`.
 * `chatflowId` comes from workflow.meta when the session is linked to a canvas row.
 */
export function openIdeasChatFromCoreSession(
    session: CoreChatHubSessionPointer,
    workflowMeta?: CoreWorkflowMetaPointer | null
): OpenIdeasChatSessionPointer {
    const pointer = openIdeasPointerFromWorkflowMeta(workflowMeta)
    return {
        chatId: session.id,
        chatflowId: pointer?.chatflowId ?? session.workflowId
    }
}

/** Origins Core uses to iframe this canvas. Set `IFRAME_ORIGINS` to this CSV locally. */
export function coreCanvasIframeOrigins(): string[] {
    return ['http://localhost:5678', 'http://localhost:15678', 'https://wt-flowise-replacement.localhost']
}

export function coreCanvasIframeOriginsCsv(): string {
    return coreCanvasIframeOrigins().join(',')
}
