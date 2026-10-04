import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import chatflowsApi from '@/api/chatflows'
import { baseURL } from '@/store/constant'
import { diagramAssetBase, loadDiagramStudio } from '@/views/diagram/loadDiagramBundle'

const EMPTY_AGENT_FLOW_DATA = JSON.stringify({
    schema: 'ideaflow-diagram/v1',
    family: 'agent',
    dsl: '',
    nodes: [
        {
            id: 'startAgentflow_0',
            type: 'agentFlow',
            position: { x: 80, y: 80 },
            data: {
                label: 'Start',
                name: 'startAgentflow',
                shape: 'rect',
                category: 'Agent Flows',
                inputs: { startInputType: 'chatInput' },
                inputParams: []
            }
        }
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
})

let createInflight = null

function asAgentBlob(flowData) {
    if (!flowData || !String(flowData).trim()) return EMPTY_AGENT_FLOW_DATA
    try {
        const parsed = JSON.parse(flowData)
        if (parsed?.schema === 'ideaflow-diagram/v1' && parsed.family === 'agent') return flowData
        if (Array.isArray(parsed?.nodes)) {
            return JSON.stringify({
                schema: 'ideaflow-diagram/v1',
                family: 'agent',
                dsl: '',
                nodes: parsed.nodes,
                edges: parsed.edges || [],
                viewport: parsed.viewport || { x: 0, y: 0, zoom: 1 }
            })
        }
    } catch {
        /* keep the empty agent document */
    }
    return EMPTY_AGENT_FLOW_DATA
}

function hostGateway() {
    const host = window.__PROJECTO_HOST_CONFIG__ || {}
    return {
        baseUrl: import.meta.env.VITE_PROJECTO_INFERENCE_BASE || host.PROJECTO_INFERENCE_BASE || 'http://127.0.0.1:4716/v1',
        apiKey: import.meta.env.VITE_PROJECTO_OPERATOR_API_KEY || host.PROJECTO_OPERATOR_API_KEY || ''
    }
}

const DiagramAgentView = () => {
    const { id } = useParams()
    const navigate = useNavigate()
    const hostRef = useRef(null)
    const nameRef = useRef('Untitled agent')
    const flowRef = useRef(EMPTY_AGENT_FLOW_DATA)
    const typeRef = useRef('DIAGRAM')
    const [name, setName] = useState('Untitled agent')
    const [status, setStatus] = useState('')
    const [error, setError] = useState('')
    const [flowData, setFlowData] = useState('')

    useEffect(() => {
        nameRef.current = name
    }, [name])

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            try {
                if (!id) {
                    if (!createInflight) {
                        createInflight = chatflowsApi
                            .createNewChatflow({
                                name: 'Untitled agent',
                                deployed: false,
                                isPublic: false,
                                type: 'DIAGRAM',
                                flowData: EMPTY_AGENT_FLOW_DATA
                            })
                            .finally(() => {
                                createInflight = null
                            })
                    }
                    const created = await createInflight
                    if (!cancelled) navigate(`/v2/agentcanvas/${created.data.id}`, { replace: true })
                    return
                }
                const loaded = await chatflowsApi.getSpecificChatflow(id)
                if (cancelled) return
                const chatflow = loaded.data
                if (chatflow.type && chatflow.type !== 'DIAGRAM' && chatflow.type !== 'AGENTFLOW') {
                    setError('This record is not an agent diagram.')
                    return
                }
                typeRef.current = chatflow.type === 'AGENTFLOW' ? 'AGENTFLOW' : 'DIAGRAM'
                nameRef.current = chatflow.name || 'Untitled agent'
                flowRef.current = asAgentBlob(chatflow.flowData)
                setName(nameRef.current)
                setFlowData(flowRef.current)
            } catch (loadError) {
                if (!cancelled) setError(loadError?.response?.data?.message || loadError.message || 'Could not open agent diagram')
            }
        }
        setError('')
        setFlowData('')
        run()
        return () => {
            cancelled = true
        }
    }, [id, navigate])

    useEffect(() => {
        const element = hostRef.current
        if (!id || !flowData || !element) return undefined
        let cancelled = false
        let handle = null
        const save = async (nextFlowData) => {
            flowRef.current = nextFlowData
            await chatflowsApi.updateChatflow(id, {
                name: nameRef.current,
                type: typeRef.current,
                flowData: nextFlowData
            })
            setStatus('Saved')
        }
        loadDiagramStudio()
            .then((api) => {
                if (cancelled) return
                handle = api.mount(element, {
                    flowData,
                    assetBase: diagramAssetBase(),
                    gateway: hostGateway(),
                    signalingBase: `${baseURL}/api/v1/diagram-signaling`,
                    diagramId: id,
                    onChange: (next) => {
                        flowRef.current = next
                    },
                    onSave: save
                })
            })
            .catch((loadError) => {
                if (!cancelled) setError(loadError.message)
            })
        return () => {
            cancelled = true
            handle?.unmount()
            window.OpenIdeasDiagram?.unmount(element)
        }
    }, [id, flowData])

    const rename = async () => {
        if (!id) return
        try {
            await chatflowsApi.updateChatflow(id, {
                name,
                type: typeRef.current,
                flowData: flowRef.current
            })
            setStatus('Saved')
        } catch (saveError) {
            setError(saveError?.response?.data?.message || saveError.message || 'Could not save agent diagram')
        }
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #d5ddd6' }}>
                <Link to='/agentflows'>Agents</Link>
                <input value={name} onChange={(event) => setName(event.target.value)} onBlur={rename} aria-label='Agent name' />
                {status ? <span>{status}</span> : null}
                {error ? <span style={{ color: '#8d2a2a' }}>{error}</span> : null}
            </div>
            <div ref={hostRef} style={{ flex: 1, minHeight: 0 }} />
        </div>
    )
}

export default DiagramAgentView
