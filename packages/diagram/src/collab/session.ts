import type { CollabProvider, CollabSession, CollabUpdate } from './types'

export type { CollabSession }

/**
 * Minimal Yjs-compatible document for the diagram DSL string.
 * Uses a tiny CRDT-ish last-write + merge by broadcasting full snapshots when yjs is unavailable,
 * and real Y.Doc when `yjs` is present.
 */
export async function createCollabSession(initialDsl: string, provider: CollabProvider): Promise<CollabSession> {
    try {
        const Y = await import('yjs')
        return createYjsSession(Y, initialDsl, provider)
    } catch {
        return createSnapshotSession(initialDsl, provider)
    }
}

function createYjsSession(Y: typeof import('yjs'), initialDsl: string, provider: CollabProvider): CollabSession {
    const doc = new Y.Doc()
    const text = doc.getText('dsl')
    // All peers opening the same persisted DSL must share the seed's CRDT identity.
    // Independent inserts use different client IDs, so later edits cannot delete
    // another peer's seed and may remain pending on unknown CRDT items.
    if (initialDsl) {
        const seed = new Y.Doc()
        seed.clientID = 0
        seed.getText('dsl').insert(0, initialDsl)
        Y.applyUpdate(doc, Y.encodeStateAsUpdate(seed))
        seed.destroy()
    }

    const listeners = new Set<(dsl: string) => void>()
    const emit = () => {
        const value = text.toString()
        for (const listener of listeners) listener(value)
    }

    doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === 'remote') {
            emit()
            return
        }
        provider.broadcast(update)
        emit()
    })

    const stopRemote = provider.onRemote((update) => {
        Y.applyUpdate(doc, update, 'remote')
    })

    return {
        getDsl: () => text.toString(),
        setDsl: (dsl: string) => {
            doc.transact(() => {
                text.delete(0, text.length)
                if (dsl) text.insert(0, dsl)
            }, 'local')
        },
        onDsl: (handler) => {
            listeners.add(handler)
            return () => listeners.delete(handler)
        },
        destroy: () => {
            stopRemote()
            provider.destroy()
            doc.destroy()
            listeners.clear()
        }
    }
}

/** Snapshot provider path used when yjs cannot be loaded (tests can still converge). */
function createSnapshotSession(initialDsl: string, provider: CollabProvider): CollabSession {
    let dsl = initialDsl
    const listeners = new Set<(dsl: string) => void>()
    const encoder = new TextEncoder()
    const decoder = new TextDecoder()

    const stopRemote = provider.onRemote((update: CollabUpdate) => {
        dsl = decoder.decode(update)
        for (const listener of listeners) listener(dsl)
    })

    return {
        getDsl: () => dsl,
        setDsl: (next: string) => {
            dsl = next
            provider.broadcast(encoder.encode(next))
            for (const listener of listeners) listener(dsl)
        },
        onDsl: (handler) => {
            listeners.add(handler)
            return () => listeners.delete(handler)
        },
        destroy: () => {
            stopRemote()
            provider.destroy()
            listeners.clear()
        }
    }
}
