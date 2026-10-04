import { describe, expect, it } from 'vitest'
import { documentFromCanvas } from '../document'
import { serializeDocument } from '../schema'
import { agentNode, emptyAgentDocument } from './agent'

describe('agent family', () => {
    it('stores Start and Direct Reply component nodes on the v1 blob', () => {
        const start = agentNode('startAgentflow', 0, { x: 40, y: 40 })
        const reply = agentNode('directReplyAgentflow', 0, { x: 40, y: 180 })
        reply.data.inputs = { directReplyMessage: 'hello' }
        const document = documentFromCanvas(
            emptyAgentDocument(),
            [start, reply],
            [{ id: 'e-start-reply', source: start.id, target: reply.id }]
        )
        expect(document.family).toBe('agent')
        expect(document.nodes.map((node) => node.data.name)).toEqual(['startAgentflow', 'directReplyAgentflow'])
        const saved = JSON.parse(serializeDocument(document))
        expect(saved.schema).toBe('ideaflow-diagram/v1')
        expect(saved.family).toBe('agent')
        expect(saved.nodes[0].data.inputs.startInputType).toBe('chatInput')
        expect(saved.nodes[1].data.inputs.directReplyMessage).toBe('hello')
        expect(saved.nodes[1].type).toBe('agentFlow')
    })
})
