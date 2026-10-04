import { describe, expect, it } from 'vitest'
import { createSignalingClient } from './webrtcProvider'

describe('signaling session transport', () => {
    it('uses the existing session path for join, signal, poll and leave', async () => {
        const calls: Array<{ url: string; init?: RequestInit }> = []
        const client = createSignalingClient({
            baseUrl: '/api/v1/diagram-signaling',
            roomId: 'agent-1',
            peerId: 'peer-1',
            pollMs: 1,
            fetchImpl: (async (url: string, init?: RequestInit) => {
                calls.push({ url, init })
                return new Response(JSON.stringify({ peerIds: ['peer-1'], messages: [] }))
            }) as typeof fetch
        })
        await client.join()
        await client.postSignal('peer-2', { kind: 'offer' })
        client.startPolling()
        await client.leave()
        expect(calls.map((call) => call.url.split('/').pop()?.split('?')[0])).toEqual(['join', 'signal', 'poll', 'leave'])
        for (const { init } of calls) {
            expect(init?.credentials).toBe('include')
            expect(new Headers(init?.headers).get('x-request-from')).toBe('internal')
            expect(new Headers(init?.headers).has('Authorization')).toBe(false)
        }
    })
})
