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
    const room = getRoom(roomId)
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
    const room = getRoom(roomId)
    if (!room.peers.has(message.from)) room.peers.add(message.from)
    const queue = room.inbox.get(message.to) || []
    queue.push({ ...message, at: Date.now() })
    room.inbox.set(message.to, queue)
}

export function pollSignals(roomId: string, peerId: string): Array<{ type: 'signal'; from: string; to: string; payload: unknown }> {
    const room = rooms.get(roomId)
    if (!room) return []
    const queue = room.inbox.get(peerId) || []
    room.inbox.set(peerId, [])
    return queue.map((item) => ({ type: 'signal' as const, from: item.from, to: item.to, payload: item.payload }))
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
