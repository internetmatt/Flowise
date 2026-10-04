import { describe, expect, it, vi } from 'vitest'
import { applyElkPositions, elkGraph, layoutWithElk } from './elk'

describe('ELK worker', () => {
    it('posts the graph to a worker and applies positions', async () => {
        const posted: unknown[] = []
        class FakeWorker {
            onmessage: ((event: MessageEvent) => void) | null = null
            onerror: (() => void) | null = null
            constructor(public url: string) {}
            postMessage(data: unknown) {
                posted.push(data)
                this.onmessage?.({ data: { ok: true, result: { children: [{ id: 'A', x: 10, y: 24 }] } } } as MessageEvent)
            }
            terminate() {}
        }
        vi.stubGlobal('Worker', FakeWorker)
        const nodes = await layoutWithElk(
            [{ id: 'A', position: { x: 0, y: 0 }, data: { label: 'Start', shape: 'rect' }, type: 'flowchart' }],
            [],
            'TD',
            '/diagram-studio/elk.worker.js'
        )
        expect(nodes[0]?.position).toEqual({ x: 10, y: 24 })
        expect(posted[0]).toMatchObject({ id: 'root', children: [{ id: 'A' }] })
        expect(elkGraph([{ id: 'A', position: { x: 0, y: 0 }, data: { label: 'A' } }], [], 'LR').layoutOptions['elk.algorithm']).toBe(
            'layered'
        )
        expect(elkGraph([{ id: 'A', position: { x: 0, y: 0 }, data: { label: 'A' } }], [], 'LR').layoutOptions['elk.direction']).toBe(
            'RIGHT'
        )
        expect(
            elkGraph([{ id: 'A', position: { x: 0, y: 0 }, data: { label: 'A' } }], [], 'LR', 'schematic').layoutOptions['elk.edgeRouting']
        ).toBe('ORTHOGONAL')
        expect(
            elkGraph([{ id: 'A', position: { x: 0, y: 0 }, data: { label: 'A' } }], [], 'LR', 'schematic').layoutOptions['elk.algorithm']
        ).toBe('layered')
        expect(applyElkPositions([{ id: 'B', position: { x: 1, y: 1 }, data: { label: 'B' } }], { children: [] })[0]?.position).toEqual({
            x: 1,
            y: 1
        })
        vi.unstubAllGlobals()
    })

    it('posts orthogonal edge routing for a schematic', async () => {
        const posted: unknown[] = []
        class FakeWorker {
            onmessage: ((event: MessageEvent) => void) | null = null
            onerror: (() => void) | null = null
            postMessage(data: unknown) {
                posted.push(data)
                this.onmessage?.({ data: { ok: true, result: { children: [] } } } as MessageEvent)
            }
            terminate() {}
        }
        vi.stubGlobal('Worker', FakeWorker)
        await layoutWithElk(
            [
                { id: 'Supply', position: { x: 0, y: 0 }, data: { label: 'Supply' } },
                { id: 'Load', position: { x: 0, y: 0 }, data: { label: 'Load' } }
            ],
            [{ id: 'e1', source: 'Supply', target: 'Load' }],
            'LR',
            '/diagram-studio/elk.worker.js',
            'schematic'
        )
        expect(posted[0]).toMatchObject({
            layoutOptions: { 'elk.algorithm': 'layered', 'elk.edgeRouting': 'ORTHOGONAL' }
        })
        vi.unstubAllGlobals()
    })
})
