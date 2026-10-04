import { joinRoom, leaveRoom, pollSignals, postSignal, resetSignalingRooms } from './index'

describe('diagram signaling', () => {
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
