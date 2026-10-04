import { describe, expect, it } from 'vitest'
import { createCollabSession } from './session'
import { createStubProviderPair } from './stubProvider'

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
})
