/** Opt-in diagram collaboration. Durable save still writes flowData; this only syncs live. */

export type CollabUpdate = Uint8Array

export type CollabProvider = {
    /** Send a Yjs (or stub) update to peers. */
    broadcast: (update: CollabUpdate) => void
    /** Subscribe to remote updates. Returns unsubscribe. */
    onRemote: (handler: (update: CollabUpdate, origin?: string) => void) => () => void
    /** Tear down transport. Must not throw if peers already left. */
    destroy: () => void
}

export type CollabSession = {
    getDsl: () => string
    setDsl: (dsl: string) => void
    onDsl: (handler: (dsl: string) => void) => () => void
    destroy: () => void
}

export type SignalingMessage =
    | { type: 'join'; peerId: string }
    | { type: 'leave'; peerId: string }
    | { type: 'peers'; peerIds: string[] }
    | { type: 'signal'; from: string; to: string; payload: unknown }
