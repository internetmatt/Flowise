import { applyGeneratedCompletion } from '../document'
import type { DiagramDocument, DiagramNode } from '../schema'
import type { FlowDirection } from '../mermaid/flowchart'
import { readDirection } from '../mermaid/flowchart'

export const DEFAULT_GATEWAY_BASE = '/api/v1/diagram-inference'

export type GatewayConfig = {
    /** Authenticated IdeaFlow proxy for the current diagram ID. No operator credentials. */
    baseUrl?: string
}

export type GatewayModel = { id: string }

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const SYSTEM_PROMPT = 'Return only a Mermaid flowchart. No prose. Use a flowchart TD (or LR) header and node edges.'

export function resolveGatewayConfig(overrides: GatewayConfig = {}): GatewayConfig {
    return { baseUrl: overrides.baseUrl || DEFAULT_GATEWAY_BASE }
}

export async function listModels(config: GatewayConfig, fetchImpl: FetchLike = fetch): Promise<GatewayModel[]> {
    const resolved = resolveGatewayConfig(config)
    assertGatewayBase(resolved.baseUrl || DEFAULT_GATEWAY_BASE)
    const response = await fetchImpl(endpoint(resolved.baseUrl || DEFAULT_GATEWAY_BASE, '/models'), {
        method: 'GET',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-request-from': 'internal' }
    })
    await assertOk(response)
    const body = (await response.json()) as { data?: Array<{ id?: string }> }
    return (body.data ?? []).flatMap((model) => (model.id ? [{ id: String(model.id) }] : []))
}

export async function completeChat(
    config: GatewayConfig,
    input: { model: string; prompt: string },
    fetchImpl: FetchLike = fetch
): Promise<string> {
    const resolved = resolveGatewayConfig(config)
    const base = resolved.baseUrl || DEFAULT_GATEWAY_BASE
    assertGatewayBase(base)
    const response = await fetchImpl(endpoint(base, '/chat/completions'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'x-request-from': 'internal' },
        body: JSON.stringify({
            model: input.model,
            temperature: 0,
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: input.prompt }
            ]
        })
    })
    await assertOk(response)
    const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> }
    const content = body.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('Gateway returned an empty completion')
    return content
}

export async function generateDiagram(options: {
    current: DiagramDocument
    prompt: string
    model: string
    gateway?: GatewayConfig
    fetchImpl?: FetchLike
    layout?: (nodes: DiagramNode[], edges: DiagramDocument['edges'], direction: FlowDirection) => Promise<DiagramNode[]>
}): Promise<{ document: DiagramDocument; error: string | null }> {
    const content = await completeChat(
        options.gateway ?? resolveGatewayConfig(),
        { model: options.model, prompt: options.prompt },
        options.fetchImpl
    )
    const applied = applyGeneratedCompletion(options.current, content)
    if (applied.error) return { document: options.current, error: applied.error }
    if (!options.layout) return applied
    try {
        const direction = readDirection(applied.document.dsl)
        const nodes = await options.layout(applied.document.nodes, applied.document.edges, direction)
        return { document: { ...applied.document, nodes }, error: null }
    } catch {
        return applied
    }
}

export function assertGatewayBase(base: string): void {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const url = new URL(base, origin)
    if (
        !['http:', 'https:'].includes(url.protocol) ||
        base.startsWith('//') ||
        url.username ||
        url.password ||
        !/^\/api\/v1\/diagram-inference\/[^/]+\/?$/.test(url.pathname) ||
        url.search ||
        url.hash
    ) {
        throw new Error('Generation requires the authenticated IdeaFlow diagram inference proxy')
    }
}

function endpoint(base: string, path: string): string {
    return `${base.replace(/\/+$/, '')}${path}`
}

async function assertOk(response: Response): Promise<void> {
    if (response.ok) return
    const detail = await response.text().catch(() => '')
    throw new Error(`Gateway request failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`)
}
