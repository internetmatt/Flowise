import { create } from 'zustand'
import { documentFromCanvas, tryApplyDsl } from '../document'
import { agentNode } from '../families/agent'
import { getFamily } from '../families'
import { generateDiagram, listModels, type GatewayConfig, type GatewayModel } from '../generation/client'
import { fallbackGrid, layoutWithElk } from '../layout/elk'
import { readDirection } from '../mermaid/flowchart'
import { validateMermaid } from '../mermaid/validate'
import {
    parseDiagramDocument,
    serializeDocument,
    type DiagramDocument,
    type DiagramEdge,
    type DiagramFamily,
    type DiagramNode,
    type DiagramViewport
} from '../schema'

export type StudioState = {
    document: DiagramDocument
    dslDraft: string
    error: string | null
    models: GatewayModel[]
    model: string
    prompt: string
    busy: boolean
    setPrompt: (prompt: string) => void
    setModel: (model: string) => void
    setViewport: (viewport: DiagramViewport) => void
    commitCanvas: (nodes: DiagramNode[], edges: DiagramEdge[]) => void
    commitDsl: (dsl: string) => Promise<void>
    addNode: () => Promise<void>
    addPaletteNode: (componentName: string) => Promise<void>
    generate: () => Promise<void>
    loadModels: () => Promise<void>
}

export function createStudioStore(options: {
    flowData: string
    gateway: GatewayConfig
    assetBase: string
    onChange?: (flowData: string) => void
}) {
    const publish = (document: DiagramDocument) => {
        options.onChange?.(serializeDocument(document))
    }

    const layout = async (
        nodes: DiagramNode[],
        edges: DiagramEdge[],
        direction: ReturnType<typeof readDirection>,
        family?: DiagramFamily
    ) => {
        try {
            return await layoutWithElk(nodes, edges, direction, `${options.assetBase.replace(/\/$/, '')}/elk.worker.js`, family)
        } catch {
            return fallbackGrid(nodes, direction)
        }
    }

    return create<StudioState>((set, get) => {
        let document: DiagramDocument
        try {
            document = parseDiagramDocument(options.flowData)
        } catch (error) {
            document = parseDiagramDocument(undefined)
            return {
                document,
                dslDraft: document.dsl,
                error: error instanceof Error ? error.message : String(error),
                models: [],
                model: '',
                prompt: '',
                busy: false,
                setPrompt: (prompt) => set({ prompt }),
                setModel: (model) => set({ model }),
                setViewport: (viewport) => {
                    const next = { ...get().document, viewport }
                    set({ document: next })
                    publish(next)
                },
                commitCanvas: () => undefined,
                commitDsl: async () => undefined,
                addNode: async () => undefined,
                addPaletteNode: async () => undefined,
                generate: async () => undefined,
                loadModels: async () => undefined
            }
        }

        return {
            document,
            dslDraft: document.dsl,
            error: null,
            models: [],
            model: '',
            prompt: '',
            busy: false,
            setPrompt: (prompt) => set({ prompt }),
            setModel: (model) => set({ model }),
            setViewport: (viewport) => {
                const next = { ...get().document, viewport }
                set({ document: next })
                publish(next)
            },
            commitCanvas: (nodes, edges) => {
                if (!getFamily(get().document.family).editable) return
                const next = documentFromCanvas(get().document, nodes, edges)
                set({ document: next, dslDraft: next.dsl, error: null })
                publish(next)
            },
            commitDsl: async (dsl) => {
                const current = get().document
                const family = getFamily(current.family)
                if (!family.hasDslRoundTrip) {
                    set({ error: `Family ${current.family} does not support DSL editing yet` })
                    return
                }
                const applied = tryApplyDsl(current, dsl)
                if (applied.error || applied.document === current) {
                    set({ error: applied.error })
                    return
                }
                if (current.family === 'flowchart') {
                    try {
                        await validateMermaid(applied.document.dsl)
                    } catch (error) {
                        set({ error: error instanceof Error ? error.message : String(error) })
                        return
                    }
                }
                const nodes = await layout(
                    applied.document.nodes,
                    applied.document.edges,
                    readDirection(applied.document.dsl),
                    current.family
                )
                const next = { ...applied.document, nodes }
                set({ document: next, dslDraft: next.dsl, error: null })
                publish(next)
            },
            addNode: async () => {
                const current = get().document
                const family = getFamily(current.family)
                if (!family.editable) return
                if (current.family === 'agent') {
                    const hasStart = current.nodes.some((node) => node.data.name === 'startAgentflow')
                    await get().addPaletteNode(hasStart ? 'directReplyAgentflow' : 'startAgentflow')
                    return
                }
                const id = nextNodeId(current.nodes)
                const nodes = [
                    ...current.nodes,
                    {
                        id,
                        type: current.family,
                        position: { x: 0, y: 0 },
                        data: { label: family.defaultNodeLabel(current.nodes.length + 1), shape: 'rect' }
                    }
                ]
                const previous = current.nodes[current.nodes.length - 1]
                const edges = previous
                    ? [...current.edges, { id: `e-${previous.id}-${id}`, source: previous.id, target: id }]
                    : current.edges
                const laid = await layout(nodes, edges, readDirection(current.dsl), current.family)
                const next = documentFromCanvas(current, laid, edges)
                set({ document: next, dslDraft: next.dsl, error: null })
                publish(next)
            },
            addPaletteNode: async (componentName) => {
                const current = get().document
                if (current.family !== 'agent') return
                if (componentName === 'startAgentflow' && current.nodes.some((node) => node.data.name === 'startAgentflow')) {
                    set({ error: 'An agent flow already has a Start node.' })
                    return
                }
                const index = current.nodes.filter((node) => node.data.name === componentName).length
                const node = agentNode(componentName, index, { x: 80, y: 80 + current.nodes.length * 140 })
                const previous = current.nodes[current.nodes.length - 1]
                const nodes = [...current.nodes, node]
                const edges = previous
                    ? [...current.edges, { id: `e-${previous.id}-${node.id}`, source: previous.id, target: node.id }]
                    : current.edges
                const next = documentFromCanvas(current, nodes, edges)
                set({ document: next, dslDraft: next.dsl, error: null })
                publish(next)
            },
            generate: async () => {
                const current = get().document
                if (current.family !== 'flowchart') {
                    set({ error: 'Generation currently supports flowchart only' })
                    return
                }
                const prompt = get().prompt.trim()
                if (!prompt) {
                    set({ error: 'Enter a prompt first.' })
                    return
                }
                set({ busy: true, error: null })
                try {
                    const result = await generateDiagram({
                        current,
                        prompt,
                        model: get().model,
                        gateway: options.gateway,
                        layout: (nodes, edges, direction) => layout(nodes, edges, direction)
                    })
                    if (result.error) {
                        set({ busy: false, error: result.error })
                        return
                    }
                    set({ busy: false, error: null, document: result.document, dslDraft: result.document.dsl })
                    publish(result.document)
                } catch (error) {
                    set({ busy: false, error: error instanceof Error ? error.message : String(error) })
                }
            },
            loadModels: async () => {
                try {
                    const models = await listModels(options.gateway)
                    set({ models, model: get().model || models[0]?.id || '' })
                } catch (error) {
                    set({ error: error instanceof Error ? error.message : String(error) })
                }
            }
        }
    })
}

function nextNodeId(nodes: DiagramNode[]): string {
    const taken = new Set(nodes.map((node) => node.id))
    let index = nodes.length + 1
    while (taken.has(`N${index}`)) index += 1
    return `N${index}`
}
