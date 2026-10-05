import { describe, expect, it } from 'vitest'
import { emptyFlowchartDocument } from '../schema'
import { assertGatewayBase, generateDiagram, listModels, resolveGatewayConfig } from './client'

const PROXY_BASE = '/api/v1/diagram-inference/diagram-1'

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('inference gateway client', () => {
    it('drops legacy credentials and refuses direct gateway or vendor URLs', () => {
        expect(resolveGatewayConfig({ baseUrl: PROXY_BASE, apiKey: 'legacy-secret' } as any)).toEqual({ baseUrl: PROXY_BASE })
        expect(() => assertGatewayBase(PROXY_BASE)).not.toThrow()
        expect(() => assertGatewayBase(`http://localhost:3010${PROXY_BASE}`)).not.toThrow()
        for (const base of [
            'http://127.0.0.1:4716/v1',
            'https://api.openai.com/v1',
            '/api/v1/chatflows',
            '//attacker.test/api/v1/diagram-inference/id'
        ]) {
            expect(() => assertGatewayBase(base)).toThrow()
        }
    })

    it('lists models and replaces the canvas from a stubbed completion', async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = []
        const fetchImpl = async (url: string, init?: RequestInit) => {
            calls.push({ url, init })
            if (url.endsWith('/models')) return jsonResponse({ data: [{ id: 'projecto/local' }] })
            return jsonResponse({
                choices: [{ message: { content: '```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```' } }]
            })
        }
        const gateway = { baseUrl: PROXY_BASE }
        const models = await listModels(gateway, fetchImpl)
        expect(models).toEqual([{ id: 'projecto/local' }])

        const previous = {
            ...emptyFlowchartDocument(),
            dsl: 'flowchart TD\n  X[Old] --> Y[Keep]',
            nodes: [
                { id: 'X', type: 'flowchart', position: { x: 1, y: 2 }, data: { label: 'Old', shape: 'rect' } },
                { id: 'Y', type: 'flowchart', position: { x: 3, y: 4 }, data: { label: 'Keep', shape: 'rect' } }
            ],
            edges: [{ id: 'e-X-Y', source: 'X', target: 'Y' }]
        }
        const result = await generateDiagram({
            current: previous,
            prompt: 'start then end',
            model: 'projecto/local',
            gateway,
            fetchImpl
        })

        expect(calls.map((call) => call.url)).toEqual([`${PROXY_BASE}/models`, `${PROXY_BASE}/chat/completions`])
        const completion = calls[1]
        expect(completion?.init?.method).toBe('POST')
        expect(new Headers(completion?.init?.headers).get('Authorization')).toBeNull()
        expect(result.error).toBeNull()
        expect(result.document.nodes.map((node) => node.id)).toEqual(['A', 'B'])
        expect(result.document.dsl).toContain('A[Start]')
        expect(result.document).not.toBe(previous)
        expect(completion.init?.credentials).toBe('include')
        expect(new Headers(completion.init?.headers).get('x-request-from')).toBe('internal')
        expect(JSON.stringify(result.document)).not.toContain('apiKey')
    })

    it('leaves the previous canvas in place when the completion is not a flowchart', async () => {
        const fetchImpl = async (url: string) => {
            if (url.endsWith('/models')) return jsonResponse({ data: [] })
            return jsonResponse({ choices: [{ message: { content: 'Sorry, I cannot draw that.' } }] })
        }
        const previous = {
            ...emptyFlowchartDocument(),
            dsl: 'flowchart TD\n  X[Old] --> Y[Keep]',
            nodes: [{ id: 'X', type: 'flowchart', position: { x: 8, y: 9 }, data: { label: 'Old', shape: 'rect' } }],
            edges: []
        }
        const result = await generateDiagram({
            current: previous,
            prompt: 'nope',
            model: 'projecto/local',
            gateway: { baseUrl: PROXY_BASE },
            fetchImpl
        })
        expect(result.error).toMatch(/Could not parse flowchart DSL/)
        expect(result.document).toBe(previous)
        expect(result.document.nodes[0]?.position).toEqual({ x: 8, y: 9 })
    })
})
