import {
    joinRoom,
    leaveRoom,
    pollSignals,
    postSignal,
    resetSignalingRooms,
    MAX_SIGNALS_PER_PEER,
    MAX_SIGNAL_BYTES,
    SIGNAL_TTL_MS
} from './index'

describe('diagram signaling', () => {
    afterEach(() => jest.restoreAllMocks())

    it('rejects nonexistent rooms, senders, destinations and departed peers', () => {
        expect(() => postSignal('missing', { from: 'a', to: 'b', payload: {} })).toThrow(/joined/)
        joinRoom('room', 'a')
        expect(() => postSignal('room', { from: 'a', to: 'missing', payload: {} })).toThrow(/joined/)
        joinRoom('room', 'b')
        expect(() => postSignal('room', { from: 'missing', to: 'b', payload: {} })).toThrow(/joined/)
        leaveRoom('room', 'b')
        expect(() => postSignal('room', { from: 'a', to: 'b', payload: {} })).toThrow(/joined/)
        expect(pollSignals('room', 'missing')).toEqual([])
    })

    it('caps queue length and payload bytes', () => {
        joinRoom('room', 'a')
        joinRoom('room', 'b')
        expect(() => postSignal('room', { from: 'a', to: 'b', payload: 'x'.repeat(MAX_SIGNAL_BYTES) })).toThrow(/large/)
        for (let i = 0; i < MAX_SIGNALS_PER_PEER; i++) postSignal('room', { from: 'a', to: 'b', payload: { i } })
        expect(() => postSignal('room', { from: 'a', to: 'b', payload: {} })).toThrow(/full/)
        expect(pollSignals('room', 'b')).toHaveLength(MAX_SIGNALS_PER_PEER)
    })

    it('expires old signals and reclaims queue capacity on send', () => {
        const now = jest.spyOn(Date, 'now').mockReturnValue(100)
        joinRoom('room', 'a')
        joinRoom('room', 'b')
        for (let i = 0; i < MAX_SIGNALS_PER_PEER; i++) postSignal('room', { from: 'a', to: 'b', payload: {} })
        now.mockReturnValue(100 + SIGNAL_TTL_MS)
        expect(pollSignals('room', 'b')).toEqual([])
        postSignal('room', { from: 'a', to: 'b', payload: 'new' })
        now.mockReturnValue(100 + 2 * SIGNAL_TTL_MS)
        postSignal('room', { from: 'a', to: 'b', payload: 'fresh' })
        expect(pollSignals('room', 'b').map((message) => message.payload)).toEqual(['fresh'])
    })

    beforeEach(() => {
        resetSignalingRooms()
    })

    it('delivers signals between peers in a room', () => {
        const a = joinRoom('diag-1', 'peer-a')
        expect(a.peerIds).toContain('peer-a')
        joinRoom('diag-1', 'peer-b')
        postSignal('diag-1', { from: 'peer-a', to: 'peer-b', payload: { kind: 'offer' } })
        expect(pollSignals('diag-1', 'peer-b')).toEqual([{ type: 'signal', from: 'peer-a', to: 'peer-b', payload: { kind: 'offer' } }])
        expect(pollSignals('diag-1', 'peer-b')).toEqual([])
        leaveRoom('diag-1', 'peer-a')
        leaveRoom('diag-1', 'peer-b')
    })
})
