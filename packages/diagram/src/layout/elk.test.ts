import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyElkPositions, elkGraph, layoutWithElk } from './elk'

const nodes = [{ id: 'A', position: { x: 0, y: 0 }, data: { label: 'Start', shape: 'rect' }, type: 'flowchart' }]
const workerUrl = '/diagram-studio/elk.worker.js'
type Request = { id: number; cmd: string; graph?: unknown }

class FakeWorker {
    static instances: FakeWorker[] = []
    posted: Request[] = []
    onmessage: ((event: MessageEvent) => void) | null = null
    onerror: (() => void) | null = null
    terminate = vi.fn()
    constructor(public url: string) {
        FakeWorker.instances.push(this)
    }
    postMessage(data: Request) {
        this.posted.push(data)
        this.onmessage?.({
            data: { id: data.id, data: data.cmd === 'layout' ? { children: [{ id: 'A', x: 10, y: 24 }] } : undefined }
        } as MessageEvent)
    }
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
    FakeWorker.instances = []
})

describe('ELK worker', () => {
    it('registers algorithms, posts the graph through the ELK API and applies positions', async () => {
        vi.stubGlobal('Worker', FakeWorker)
        const result = await layoutWithElk(nodes, [], 'TD', workerUrl)
        const worker = FakeWorker.instances[0]
        expect(worker.url).toBe(workerUrl)
        expect(result[0]?.position).toEqual({ x: 10, y: 24 })
        expect(worker.posted[0]).toMatchObject({ cmd: 'register', algorithms: expect.arrayContaining(['layered']) })
        expect(worker.posted[1]).toMatchObject({ cmd: 'layout', graph: { id: 'root', children: [{ id: 'A' }] } })
        expect(worker.terminate).toHaveBeenCalledOnce()
    })

    it('maps directions and preserves nodes without returned positions', () => {
        expect(elkGraph(nodes, [], 'LR').layoutOptions).toMatchObject({ 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT' })
        expect(applyElkPositions(nodes, { children: [] })[0]?.position).toEqual({ x: 0, y: 0 })
    })

    it('posts orthogonal edge routing for a schematic', async () => {
        vi.stubGlobal('Worker', FakeWorker)
        await layoutWithElk(
            [
                { id: 'Supply', position: { x: 0, y: 0 }, data: { label: 'Supply' } },
                { id: 'Load', position: { x: 0, y: 0 }, data: { label: 'Load' } }
            ],
            [{ id: 'e1', source: 'Supply', target: 'Load' }],
            'LR',
            workerUrl,
            'schematic'
        )
        expect(FakeWorker.instances[0].posted[1]).toMatchObject({
            cmd: 'layout',
            graph: { layoutOptions: { 'elk.algorithm': 'layered', 'elk.edgeRouting': 'ORTHOGONAL' } }
        })
    })

    it('rejects layout errors and terminates the worker', async () => {
        class ErrorWorker extends FakeWorker {
            postMessage(data: Request) {
                if (data.cmd === 'register') return super.postMessage(data)
                this.onmessage?.({ data: { id: data.id, error: new Error('Invalid graph') } } as MessageEvent)
            }
        }
        vi.stubGlobal('Worker', ErrorWorker)
        await expect(layoutWithElk(nodes, [], 'TD', workerUrl)).rejects.toThrow('Invalid graph')
        expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce()
    })

    it('rejects worker load errors and cleans up the timeout', async () => {
        vi.useFakeTimers()
        class BrokenWorker extends FakeWorker {
            postMessage() {}
        }
        vi.stubGlobal('Worker', BrokenWorker)
        const layout = layoutWithElk(nodes, [], 'TD', workerUrl)
        const rejected = expect(layout).rejects.toThrow('ELK worker failed')
        FakeWorker.instances[0].onerror?.()
        await rejected
        expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce()
        expect(vi.getTimerCount()).toBe(0)
    })

    it('rejects a worker that never replies and terminates it', async () => {
        vi.useFakeTimers()
        class SilentWorker extends FakeWorker {
            postMessage() {}
        }
        vi.stubGlobal('Worker', SilentWorker)
        const rejected = expect(layoutWithElk(nodes, [], 'TD', workerUrl)).rejects.toThrow('ELK worker timed out')
        await vi.advanceTimersByTimeAsync(15000)
        await rejected
        expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce()
        expect(vi.getTimerCount()).toBe(0)
    })

    it('skips worker creation for an empty graph', async () => {
        vi.stubGlobal('Worker', FakeWorker)
        await expect(layoutWithElk([], [], 'TD', workerUrl)).resolves.toEqual([])
        expect(FakeWorker.instances).toHaveLength(0)
    })

    it('keeps the main-thread fallback when Web Workers are unavailable', async () => {
        vi.stubGlobal('Worker', undefined)
        const result = await layoutWithElk(nodes, [], 'TD', workerUrl)
        expect(result[0].position.x).toBeGreaterThan(0)
        expect(result[0].position.y).toBeGreaterThan(0)
    })
})
