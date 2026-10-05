import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
    Background,
    Controls,
    Handle,
    MiniMap,
    Position,
    ReactFlow,
    applyEdgeChanges,
    applyNodeChanges,
    type Connection,
    type Edge,
    type Node,
    type NodeProps,
    type OnEdgesChange,
    type OnNodesChange
} from '@xyflow/react'
import { useShallow } from 'zustand/react/shallow'
import { downloadBlob, exportJson, exportMermaid, exportPng, exportSvg } from '../export/exportDiagram'
import { exportFigmaSvg } from '../export/figmaSvg'
import { exportCinematicMp4 } from '../export/mp4'
import { createCollabSession, type CollabSession } from '../collab/session'
import { createSignalingClient, createWebrtcProvider } from '../collab/webrtcProvider'
import { getFamily, pictureFamilies } from '../families'
import { AGENT_PALETTE } from '../families/agent'
import { readDirection, type FlowDirection } from '../mermaid/flowchart'
import { serializeDocument, type DiagramEdge, type DiagramNode } from '../schema'
import { createStudioStore } from './store'

const DirectionContext = createContext<FlowDirection>('TD')

type FlowNode = Node<{ label: string; shape?: string }, string>

function DiagramNodeView({ data, selected }: NodeProps<FlowNode>) {
    const direction = useContext(DirectionContext)
    const horizontal = direction === 'LR' || direction === 'RL'
    return (
        <div className={`ideaflow-node ideaflow-node-${data.shape || 'rect'}${selected ? ' is-selected' : ''}`}>
            <Handle type='target' position={horizontal ? Position.Left : Position.Top} />
            <span>{data.label}</span>
            <Handle type='source' position={horizontal ? Position.Right : Position.Bottom} />
        </div>
    )
}

const nodeTypes = {
    ...Object.fromEntries(pictureFamilies().map((family) => [family.id, DiagramNodeView])),
    agentFlow: DiagramNodeView
}

export function DiagramStudio({
    flowData,
    gateway,
    assetBase = '/diagram-studio',
    signalingBase,
    diagramId,
    onSave,
    onChange
}: {
    flowData: string
    gateway?: { baseUrl?: string }
    assetBase?: string
    /** IdeaFlow signaling base, e.g. `/api/v1/diagram-signaling`. Collab stays off until started. */
    signalingBase?: string
    diagramId?: string
    onSave?: (flowData: string) => void | Promise<void>
    onChange?: (flowData: string) => void
}) {
    const onChangeRef = useRef(onChange)
    onChangeRef.current = onChange
    const storeRef = useRef<ReturnType<typeof createStudioStore> | null>(null)
    if (!storeRef.current) {
        storeRef.current = createStudioStore({
            flowData,
            gateway: gateway ?? {},
            assetBase,
            onChange: (next) => onChangeRef.current?.(next)
        })
    }
    const useStudio = storeRef.current
    const document = useStudio((state) => state.document)
    const dslDraft = useStudio((state) => state.dslDraft)
    const error = useStudio((state) => state.error)
    const models = useStudio((state) => state.models)
    const model = useStudio((state) => state.model)
    const prompt = useStudio((state) => state.prompt)
    const busy = useStudio((state) => state.busy)
    const actions = useStudio(
        useShallow((state) => ({
            setPrompt: state.setPrompt,
            setModel: state.setModel,
            setViewport: state.setViewport,
            commitCanvas: state.commitCanvas,
            commitDsl: state.commitDsl,
            addNode: state.addNode,
            addPaletteNode: state.addPaletteNode,
            generate: state.generate,
            loadModels: state.loadModels
        }))
    )

    const [nodes, setNodes] = useState<DiagramNode[]>(document.nodes)
    const [edges, setEdges] = useState<DiagramEdge[]>(document.edges)
    const [saving, setSaving] = useState(false)
    const [saveNote, setSaveNote] = useState('')
    const [collabOn, setCollabOn] = useState(false)
    const [collabNote, setCollabNote] = useState('')
    const collabRef = useRef<CollabSession | null>(null)
    const edgesRef = useRef(edges)
    edgesRef.current = edges
    const viewport = useRef(document.viewport)
    const family = getFamily(document.family)
    const canEdit = family.editable
    const applyingRemote = useRef(false)

    useEffect(() => {
        void actions.loadModels()
    }, [actions])

    useEffect(() => {
        setNodes(document.nodes)
        setEdges(document.edges)
        if (collabRef.current && !applyingRemote.current) {
            try {
                collabRef.current.setDsl(document.dsl)
            } catch {
                // Live sync must never block the editor.
            }
        }
    }, [document])

    useEffect(() => {
        return () => {
            collabRef.current?.destroy()
            collabRef.current = null
        }
    }, [])

    const direction = readDirection(document.dsl)
    const selected = nodes.find((node) => node.selected)

    const onNodesChange: OnNodesChange<FlowNode> = (changes) => {
        if (!canEdit) return
        setNodes((current) => {
            const next = applyNodeChanges(changes, current as FlowNode[]) as DiagramNode[]
            const dragEnd = changes.some((change) => change.type === 'position' && change.dragging === false)
            const structural = changes.some((change) => change.type === 'remove' || change.type === 'add' || change.type === 'replace')
            if (dragEnd || structural) actions.commitCanvas(next, edgesRef.current)
            return next
        })
    }

    const onEdgesChange: OnEdgesChange<Edge> = (changes) => {
        if (!canEdit) return
        setEdges((current) => {
            const next = applyEdgeChanges(changes, current as Edge[]) as DiagramEdge[]
            if (changes.some((change) => change.type === 'remove' || change.type === 'add' || change.type === 'replace')) {
                actions.commitCanvas(nodes, next)
            }
            return next
        })
    }

    const onConnect = (connection: Connection) => {
        if (!canEdit || !connection.source || !connection.target) return
        const next = [
            ...edges,
            { id: `e-${connection.source}-${connection.target}-${edges.length}`, source: connection.source, target: connection.target }
        ]
        setEdges(next)
        actions.commitCanvas(nodes, next)
    }

    const draftTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
    const onDraft = (value: string) => {
        useStudio.setState({ dslDraft: value })
        clearTimeout(draftTimer.current)
        draftTimer.current = setTimeout(() => {
            void actions.commitDsl(value)
        }, 400)
    }

    const exportAs = async (kind: 'svg' | 'png' | 'mermaid' | 'json' | 'figma' | 'mp4') => {
        const current = useStudio.getState().document
        if (kind === 'svg') downloadBlob('diagram.svg', exportSvg(current), 'image/svg+xml')
        if (kind === 'figma') downloadBlob('diagram-figma.svg', exportFigmaSvg(current), 'image/svg+xml')
        if (kind === 'png') downloadBlob('diagram.png', await exportPng(exportSvg(current)))
        if (kind === 'mermaid') downloadBlob('diagram.mmd', exportMermaid(current), 'text/plain')
        if (kind === 'json') downloadBlob('diagram.json', exportJson(current), 'application/json')
        if (kind === 'mp4') {
            try {
                const blob = await exportCinematicMp4(current)
                downloadBlob('diagram.mp4', blob, blob.type || 'video/mp4')
            } catch (exportError) {
                useStudio.setState({ error: exportError instanceof Error ? exportError.message : 'MP4 export failed' })
            }
        }
    }

    const toggleCollab = async () => {
        if (collabOn) {
            collabRef.current?.destroy()
            collabRef.current = null
            setCollabOn(false)
            setCollabNote('')
            return
        }
        if (!signalingBase || !diagramId) {
            setCollabNote('Signaling is not configured for this diagram.')
            return
        }
        try {
            const signaling = createSignalingClient({ baseUrl: signalingBase, roomId: diagramId })
            const provider = createWebrtcProvider({ signaling })
            await provider.start()
            const session = await createCollabSession(useStudio.getState().document.dsl, provider)
            session.onDsl((dsl) => {
                applyingRemote.current = true
                void actions.commitDsl(dsl).finally(() => {
                    applyingRemote.current = false
                })
            })
            collabRef.current = session
            setCollabOn(true)
            setCollabNote('Live')
        } catch (collabError) {
            setCollabNote(collabError instanceof Error ? collabError.message : 'Could not start live session')
            // Save path stays available regardless.
        }
    }

    const save = async () => {
        if (!onSave) return
        setSaving(true)
        setSaveNote('')
        try {
            await onSave(serializeDocument(useStudio.getState().document))
            setSaveNote('Saved')
        } catch (saveError) {
            setSaveNote(saveError instanceof Error ? saveError.message : 'Save failed')
        } finally {
            setSaving(false)
        }
    }

    const flowNodes = useMemo(() => nodes as FlowNode[], [nodes])

    return (
        <DirectionContext.Provider value={direction}>
            <div className='ideaflow-studio'>
                <header className='ideaflow-toolbar'>
                    <strong>{family.label}</strong>
                    <button type='button' onClick={() => void actions.addNode()} disabled={busy || !canEdit}>
                        Add node
                    </button>
                    {document.family === 'agent'
                        ? AGENT_PALETTE.slice(0, 6).map((item) => (
                              <button key={item.name} type='button' onClick={() => void actions.addPaletteNode(item.name)} disabled={busy}>
                                  {item.label}
                              </button>
                          ))
                        : null}
                    <button type='button' onClick={() => void exportAs('svg')}>
                        SVG
                    </button>
                    <button type='button' onClick={() => void exportAs('png')}>
                        PNG
                    </button>
                    <button type='button' onClick={() => void exportAs('mermaid')}>
                        Mermaid
                    </button>
                    <button type='button' onClick={() => void exportAs('json')}>
                        JSON
                    </button>
                    <button type='button' onClick={() => void exportAs('figma')}>
                        Figma SVG
                    </button>
                    <button type='button' onClick={() => void exportAs('mp4')}>
                        MP4
                    </button>
                    <button type='button' onClick={() => void toggleCollab()} disabled={!signalingBase || !diagramId}>
                        {collabOn ? 'Stop live' : 'Live'}
                    </button>
                    <button type='button' onClick={() => void save()} disabled={!onSave || saving}>
                        {saving ? 'Saving…' : 'Save'}
                    </button>
                    {saveNote ? <span className='ideaflow-note'>{saveNote}</span> : null}
                    {collabNote ? <span className='ideaflow-note'>{collabNote}</span> : null}
                </header>
                <div className='ideaflow-body'>
                    {canEdit ? (
                        <ReactFlow
                            nodes={flowNodes}
                            edges={edges}
                            nodeTypes={nodeTypes}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            onConnect={onConnect}
                            onMoveEnd={(_, next) => actions.setViewport(next)}
                            defaultViewport={viewport.current}
                            proOptions={{ hideAttribution: true }}
                        >
                            <Background />
                            <Controls />
                            <MiniMap />
                        </ReactFlow>
                    ) : (
                        <div className='ideaflow-readonly'>
                            <p>Family {document.family} is stored on this document.</p>
                        </div>
                    )}
                    <aside className='ideaflow-side'>
                        {selected && canEdit ? (
                            <label className='ideaflow-field'>
                                Label
                                <input
                                    value={selected.data.label}
                                    onChange={(event) => {
                                        const next = nodes.map((node) =>
                                            node.id === selected.id ? { ...node, data: { ...node.data, label: event.target.value } } : node
                                        )
                                        setNodes(next)
                                        actions.commitCanvas(next, edges)
                                    }}
                                />
                            </label>
                        ) : null}
                        <label className='ideaflow-field'>
                            DSL
                            <textarea
                                value={dslDraft}
                                spellCheck={false}
                                disabled={!family.hasDslRoundTrip || busy}
                                onChange={(event) => onDraft(event.target.value)}
                            />
                        </label>
                        {document.family === 'flowchart' ? (
                            <>
                                <label className='ideaflow-field'>
                                    Model
                                    <select value={model} onChange={(event) => actions.setModel(event.target.value)}>
                                        <option value=''>Default</option>
                                        {models.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                {item.id}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                                <label className='ideaflow-field'>
                                    Generate
                                    <textarea
                                        value={prompt}
                                        onChange={(event) => actions.setPrompt(event.target.value)}
                                        placeholder='Describe the flowchart'
                                    />
                                </label>
                                <button type='button' onClick={() => void actions.generate()} disabled={busy}>
                                    {busy ? 'Generating…' : 'Generate'}
                                </button>
                            </>
                        ) : null}
                        {error ? <p className='ideaflow-error'>{error}</p> : null}
                    </aside>
                </div>
            </div>
        </DirectionContext.Provider>
    )
}
