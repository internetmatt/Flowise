import { InternalFlowiseError } from '../../errors/internalFlowiseError'

export const MAX_SIGNALS_PER_PEER = 128
export const MAX_SIGNAL_BYTES = 16 * 1024
export const SIGNAL_TTL_MS = 30_000
const MAX_PEERS_PER_ROOM = 64

type SignalEnvelope = {
    from: string
    to: string
    payload: unknown
    at: number
}

type Room = {
    peers: Set<string>
    inbox: Map<string, SignalEnvelope[]>
}

const rooms = new Map<string, Room>()

function getRoom(roomId: string): Room {
    let room = rooms.get(roomId)
    if (!room) {
        room = { peers: new Set(), inbox: new Map() }
        rooms.set(roomId, room)
    }
    return room
}

/** In-memory signaling for diagram WebRTC. Not used by chatflow or agent execution. */
export function joinRoom(roomId: string, peerId: string): { peerIds: string[] } {
    if (peerId.length > 128) throw new InternalFlowiseError(400, 'Invalid peer ID')
    const room = getRoom(roomId)
    if (!room.peers.has(peerId) && room.peers.size >= MAX_PEERS_PER_ROOM) throw new InternalFlowiseError(429, 'Room is full')
    room.peers.add(peerId)
    if (!room.inbox.has(peerId)) room.inbox.set(peerId, [])
    return { peerIds: [...room.peers] }
}

export function leaveRoom(roomId: string, peerId: string): void {
    const room = rooms.get(roomId)
    if (!room) return
    room.peers.delete(peerId)
    room.inbox.delete(peerId)
    if (room.peers.size === 0) rooms.delete(roomId)
}

export function postSignal(roomId: string, message: { from: string; to: string; payload: unknown }): void {
    const room = rooms.get(roomId)
    if (!room || !room.peers.has(message.from) || !room.peers.has(message.to)) {
        throw new InternalFlowiseError(404, 'Both signaling peers must be joined')
    }
    const serialized = JSON.stringify(message.payload)
    if (!serialized || Buffer.byteLength(serialized, 'utf8') > MAX_SIGNAL_BYTES) {
        throw new InternalFlowiseError(413, 'Signal payload too large or missing')
    }
    const queue = (room.inbox.get(message.to) || []).filter((item) => Date.now() - item.at < SIGNAL_TTL_MS)
    if (queue.length >= MAX_SIGNALS_PER_PEER) throw new InternalFlowiseError(429, 'Signal queue is full')
    queue.push({ ...message, at: Date.now() })
    room.inbox.set(message.to, queue)
}

export function pollSignals(roomId: string, peerId: string): Array<{ type: 'signal'; from: string; to: string; payload: unknown }> {
    const room = rooms.get(roomId)
    if (!room || !room.peers.has(peerId)) return []
    const queue = room.inbox.get(peerId) || []
    room.inbox.set(peerId, [])
    return queue
        .filter((item) => Date.now() - item.at < SIGNAL_TTL_MS)
        .map((item) => ({ type: 'signal' as const, from: item.from, to: item.to, payload: item.payload }))
}

/** Test helper */
export function resetSignalingRooms(): void {
    rooms.clear()
}

export default {
    joinRoom,
    leaveRoom,
    postSignal,
    pollSignals,
    resetSignalingRooms
}
