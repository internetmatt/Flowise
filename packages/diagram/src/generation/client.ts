import { applyGeneratedCompletion } from '../document'
import type { DiagramDocument, DiagramNode } from '../schema'
import type { FlowDirection } from '../mermaid/flowchart'
import { readDirection } from '../mermaid/flowchart'

export const DEFAULT_GATEWAY_BASE = 'http://127.0.0.1:4716/v1'

export type GatewayConfig = {
    /** Includes `/v1`. Default `http://127.0.0.1:4716/v1`. */
    baseUrl?: string
    /** Operator bearer from host config. Never stored on the diagram document. */
    apiKey?: string
}

export type HostConfig = {
    PROJECTO_OPERATOR_API_KEY?: string
    PROJECTO_INFERENCE_BASE?: string
}

export type GatewayModel = { id: string }

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

const SYSTEM_PROMPT = 'Return only a Mermaid flowchart. No prose. Use a flowchart TD (or LR) header and node edges.'

export function resolveGatewayConfig(host: HostConfig = readHostConfig(), overrides: GatewayConfig = {}): GatewayConfig {
    return {
        baseUrl: overrides.baseUrl || host.PROJECTO_INFERENCE_BASE || DEFAULT_GATEWAY_BASE,
        apiKey: overrides.apiKey ?? host.PROJECTO_OPERATOR_API_KEY ?? ''
    }
}

export function readHostConfig(): HostConfig {
    const fromWindow =
        typeof window !== 'undefined' ? (window as Window & { __PROJECTO_HOST_CONFIG__?: HostConfig }).__PROJECTO_HOST_CONFIG__ : undefined
    const fromProcess = typeof process !== 'undefined' ? process.env : undefined
    const fromVite = viteEnv()
    return {
        PROJECTO_OPERATOR_API_KEY:
            fromWindow?.PROJECTO_OPERATOR_API_KEY || fromProcess?.PROJECTO_OPERATOR_API_KEY || fromVite.VITE_PROJECTO_OPERATOR_API_KEY,
        PROJECTO_INFERENCE_BASE:
            fromWindow?.PROJECTO_INFERENCE_BASE || fromProcess?.PROJECTO_INFERENCE_BASE || fromVite.VITE_PROJECTO_INFERENCE_BASE
    }
}

export async function listModels(config: GatewayConfig, fetchImpl: FetchLike = fetch): Promise<GatewayModel[]> {
    const resolved = resolveGatewayConfig({}, config)
    assertGatewayBase(resolved.baseUrl || DEFAULT_GATEWAY_BASE)
    const response = await fetchImpl(endpoint(resolved.baseUrl || DEFAULT_GATEWAY_BASE, '/models'), {
        method: 'GET',
        headers: gatewayHeaders(resolved.apiKey)
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
    const resolved = resolveGatewayConfig({}, config)
    const base = resolved.baseUrl || DEFAULT_GATEWAY_BASE
    assertGatewayBase(base)
    const response = await fetchImpl(endpoint(base, '/chat/completions'), {
        method: 'POST',
        headers: gatewayHeaders(resolved.apiKey),
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
    let url: URL
    try {
        url = new URL(base)
    } catch {
        throw new Error(`Invalid inference gateway base: ${base}`)
    }
    if (url.port === '8000') throw new Error('Refusing direct vLLM :8000. Generation uses the inference gateway.')
    if (url.port === '11434') throw new Error('Refusing Ollama. Generation uses the inference gateway.')
    const blocked = [
        'api.openai.com',
        'api.anthropic.com',
        'generativelanguage.googleapis.com',
        'api.groq.com',
        'api.mistral.ai',
        'openrouter.ai',
        'api.cerebras.ai',
        'integrate.api.nvidia.com'
    ]
    if (blocked.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`))) {
        throw new Error('Refusing a vendor API. Generation uses the inference gateway.')
    }
}

function gatewayHeaders(apiKey: string | undefined): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`
    return headers
}

function endpoint(base: string, path: string): string {
    return `${base.replace(/\/+$/, '')}${path}`
}

async function assertOk(response: Response): Promise<void> {
    if (response.ok) return
    const detail = await response.text().catch(() => '')
    throw new Error(`Gateway request failed (${response.status})${detail ? `: ${detail.slice(0, 180)}` : ''}`)
}

function viteEnv(): ImportMetaEnv {
    try {
        return import.meta.env ?? {}
    } catch {
        return {}
    }
}
