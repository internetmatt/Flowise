import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

// Trusted export policy, not an assertion about the executors enabled on a deployed host.
// Extend this policy only alongside graph/config validation and regression fixtures.
export const executorSources = Object.freeze({
    startAgentflow: { source: 'packages/components/nodes/agentflow/Start/Start.ts', entrypoint: 'run' },
    llmAgentflow: { source: 'packages/components/nodes/agentflow/LLM/LLM.ts', entrypoint: 'run' },
    chatGoogleGenerativeAI: {
        source: 'packages/components/nodes/chatmodels/ChatGoogleGenerativeAI/ChatGoogleGenerativeAI.ts',
        entrypoint: 'init'
    }
})

export function repositoryExecutors(root) {
    return Object.fromEntries(
        Object.entries(executorSources).map(([name, policy]) => {
            const source = readFileSync(resolve(root, policy.source), 'utf8')
            if (!source.includes(`this.name = '${name}'`) || !source.includes(`async ${policy.entrypoint}(`)) {
                throw new Error(`Missing executor entrypoint: ${name}`)
            }
            return [
                name,
                Object.freeze({
                    name,
                    ...policy,
                    digest: `sha256:${createHash('sha256').update(source).digest('hex')}`
                })
            ]
        })
    )
}
