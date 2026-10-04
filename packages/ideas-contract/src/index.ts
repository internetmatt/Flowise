/**
 * Types-only contract for Ideas. Do not import flowise-ui or TypeORM from here.
 * Mirrors OpenIdeas IChatFlow public JSON (packages/server/src/Interface.ts).
 */

export const FLOWISE_FLOW_TYPES = ['CHATFLOW', 'AGENTFLOW', 'MULTIAGENT', 'ASSISTANT', 'DIAGRAM'] as const

export type FlowiseFlowType = (typeof FLOWISE_FLOW_TYPES)[number]

export type FlowiseChatflow = {
    id: string
    name: string
    type?: FlowiseFlowType
    workspaceId: string
    flowData?: string
    updatedDate?: string
    deployed?: boolean
}

export const EMPTY_FLOW_DATA = JSON.stringify({
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
})

/** Local sidecar / Projecto loopback workspace. ChatFlow rows use this id. */
export const DEFAULT_FLOWISE_WORKSPACE_ID = 'General'
