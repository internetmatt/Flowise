import { describe, expect, it } from 'vitest'
import { emptyFlowchartDocument, serializeDocument } from '../schema'
import { DEFAULT_GATEWAY_BASE, generateDiagram, listModels } from './client'

const OPERATOR_KEY = 'operator-secret-not-on-document'

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('inference gateway client', () => {
    it('lists models and replaces the canvas from a stubbed completion', async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = []
        const fetchImpl = async (url: string, init?: RequestInit) => {
            calls.push({ url, init })
            if (url.endsWith('/models')) return jsonResponse({ data: [{ id: 'projecto/local' }] })
            return jsonResponse({
                choices: [{ message: { content: '```mermaid\nflowchart TD\n  A[Start] --> B[End]\n```' } }]
            })
        }
        const gateway = { baseUrl: DEFAULT_GATEWAY_BASE, apiKey: OPERATOR_KEY }
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

        expect(calls.map((call) => call.url)).toEqual(['http://127.0.0.1:4716/v1/models', 'http://127.0.0.1:4716/v1/chat/completions'])
        const completion = calls[1]
        expect(completion?.init?.method).toBe('POST')
        expect(new Headers(completion?.init?.headers).get('Authorization')).toBe(`Bearer ${OPERATOR_KEY}`)
        expect(result.error).toBeNull()
        expect(result.document.nodes.map((node) => node.id)).toEqual(['A', 'B'])
        expect(result.document.dsl).toContain('A[Start]')
        expect(result.document).not.toBe(previous)
        expect(serializeDocument(result.document)).not.toContain(OPERATOR_KEY)
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
            gateway: { baseUrl: DEFAULT_GATEWAY_BASE, apiKey: OPERATOR_KEY },
            fetchImpl
        })
        expect(result.error).toMatch(/Could not parse flowchart DSL/)
        expect(result.document).toBe(previous)
        expect(result.document.nodes[0]?.position).toEqual({ x: 8, y: 9 })
    })
})
