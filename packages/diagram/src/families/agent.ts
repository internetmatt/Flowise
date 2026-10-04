import { DIAGRAM_SCHEMA, type DiagramDocument, type DiagramEdge, type DiagramNode } from '../schema'
import type { DiagramFamilyModule } from './types'

/** Existing agentflow component nodes. Stored on the v1 blob; the executor already runs these names. */
export const AGENT_PALETTE: Array<{ name: string; label: string; inputs?: Record<string, unknown> }> = [
    { name: 'startAgentflow', label: 'Start', inputs: { startInputType: 'chatInput' } },
    { name: 'agentAgentflow', label: 'Agent' },
    { name: 'llmAgentflow', label: 'LLM' },
    { name: 'conditionAgentflow', label: 'Condition' },
    { name: 'toolAgentflow', label: 'Tool' },
    { name: 'directReplyAgentflow', label: 'Direct Reply', inputs: { directReplyMessage: '' } },
    { name: 'humanInputAgentflow', label: 'Human Input' },
    { name: 'loopAgentflow', label: 'Loop' },
    { name: 'customFunctionAgentflow', label: 'Custom Function' },
    { name: 'retrieverAgentflow', label: 'Retriever' },
    { name: 'conditionAgentAgentflow', label: 'Condition Agent' },
    { name: 'httpAgentflow', label: 'HTTP' },
    { name: 'iterationAgentflow', label: 'Iteration' },
    { name: 'executeFlowAgentflow', label: 'Execute Flow' }
]

export function agentNode(componentName: string, index: number, position = { x: 80, y: 80 }): DiagramNode {
    const spec = AGENT_PALETTE.find((item) => item.name === componentName) ?? {
        name: componentName,
        label: componentName
    }
    return {
        id: `${spec.name}_${index}`,
        type: 'agentFlow',
        position,
        data: {
            label: spec.label,
            name: spec.name,
            shape: 'rect',
            category: 'Agent Flows',
            inputParams: [],
            inputs: { ...(spec.inputs ?? {}) }
        }
    }
}

export function emptyAgentDocument(): DiagramDocument {
    return {
        schema: DIAGRAM_SCHEMA,
        family: 'agent',
        dsl: '',
        nodes: [agentNode('startAgentflow', 0, { x: 80, y: 80 })],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 }
    }
}

export const agentFamily: DiagramFamilyModule = {
    id: 'agent',
    label: 'Agent',
    editable: true,
    hasDslRoundTrip: false,
    emptyDocument: emptyAgentDocument,
    parseDsl: () => {
        throw new Error('Agent family stores component nodes, not Mermaid DSL')
    },
    serialize: (_nodes: DiagramNode[], _edges: DiagramEdge[], previousDsl = '') => previousDsl,
    defaultNodeLabel: (index) => `Node ${index}`
}
