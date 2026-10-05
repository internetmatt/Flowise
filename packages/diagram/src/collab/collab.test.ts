import { describe, expect, it } from 'vitest'
import { createCollabSession } from './session'
import { createStubProviderPair } from './stubProvider'
import type { CollabProvider, CollabUpdate } from './types'

describe('diagram collab', () => {
    it('converges two peers on one dsl string through a stubbed provider', async () => {
        const [providerA, providerB] = createStubProviderPair()
        const peerA = await createCollabSession('flowchart TD\n  A --> B', providerA)
        const peerB = await createCollabSession('flowchart TD\n  A --> B', providerB)

        const seen: string[] = []
        peerB.onDsl((dsl) => seen.push(dsl))

        peerA.setDsl('flowchart TD\n  A[Start] --> B[End]')

        expect(peerB.getDsl()).toBe('flowchart TD\n  A[Start] --> B[End]')
        expect(peerA.getDsl()).toBe(peerB.getDsl())
        expect(seen.at(-1)).toBe('flowchart TD\n  A[Start] --> B[End]')

        peerB.setDsl('flowchart TD\n  A --> C')
        expect(peerA.getDsl()).toBe('flowchart TD\n  A --> C')
        expect(peerA.getDsl()).toBe(peerB.getDsl())

        peerA.destroy()
        peerB.destroy()
    })
    it('converges concurrent edits after delayed delivery without duplicating the saved seed', async () => {
        const [a, b] = createStubProviderPair()
        const pending: (() => void)[] = []
        const delayed = (provider: CollabProvider): CollabProvider => ({
            ...provider,
            broadcast: (update: CollabUpdate) => pending.push(() => provider.broadcast(update))
        })
        const peerA = await createCollabSession('saved DSL', delayed(a))
        const peerB = await createCollabSession('saved DSL', delayed(b))
        try {
            peerA.setDsl('edit A')
            peerB.setDsl('edit B')
            for (const deliver of pending.reverse()) deliver()
            expect(peerA.getDsl()).toBe(peerB.getDsl())
            expect(peerA.getDsl()).not.toContain('saved DSL')
            // Duplicate delivery must be idempotent.
            for (const deliver of pending) deliver()
            expect(peerA.getDsl()).toBe(peerB.getDsl())
        } finally {
            peerA.destroy()
            peerB.destroy()
        }
    })
})
