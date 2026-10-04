import type { CollabProvider, CollabUpdate } from './types'

type BusHandler = (update: CollabUpdate, origin: string) => void

/** In-memory bus so two (or more) peers share updates without WebRTC. */
export function createStubProviderPair(): [CollabProvider, CollabProvider] {
    const handlers = new Map<string, Set<BusHandler>>()

    const make = (peerId: string): CollabProvider => {
        const local = new Set<BusHandler>()
        handlers.set(peerId, local)
        return {
            broadcast(update) {
                for (const [id, set] of handlers) {
                    if (id === peerId) continue
                    for (const handler of set) handler(update, peerId)
                }
            },
            onRemote(handler) {
                const wrapped: BusHandler = (update, origin) => handler(update, origin)
                local.add(wrapped)
                return () => local.delete(wrapped)
            },
            destroy() {
                handlers.delete(peerId)
                local.clear()
            }
        }
    }

    return [make('a'), make('b')]
}
