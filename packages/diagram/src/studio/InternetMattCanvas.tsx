import { useEffect, useRef } from 'react'
import type { DiagramEdge, DiagramNode, DiagramViewport } from '../schema'
import { registerFlowCanvas } from '../vendor/flow-canvas/elements/register'
import type { PfFlow } from '../vendor/flow-canvas/elements/pf-flow'
import { fromInternetMattGraph, toInternetMattGraph } from './internetMattAdapter'
import '../vendor/design-tokens.css'
import '../vendor/flow-canvas/styles.css'
import './internetmatt.css'

export function InternetMattCanvas(props: {
    nodes: DiagramNode[]
    edges: DiagramEdge[]
    viewport: DiagramViewport
    theme: 'light' | 'dark'
    onSelection: (ids: Set<string>) => void
    onCommit: (nodes: DiagramNode[], edges: DiagramEdge[], viewport: DiagramViewport) => void
}) {
    const host = useRef<HTMLDivElement>(null)
    const canvas = useRef<PfFlow | null>(null)
    const current = useRef(props)
    current.current = props
    const syncing = useRef(false)

    useEffect(() => {
        registerFlowCanvas()
        const element = document.createElement('pf-flow') as PfFlow
        element.setAttribute('aria-label', 'Internet Matt diagram canvas')
        element.tabIndex = 0
        canvas.current = element
        host.current?.appendChild(element)
        let last = ''
        const unsubscribe = element.store.subscribe(() => {
            if (syncing.current) return
            const graph = element.getGraph()
            const selection = new Set(element.store.getSelection())
            current.current.onSelection(selection)
            const next = fromInternetMattGraph(graph, current.current.nodes, current.current.edges)
            // Selection/connection previews must not rewrite a saved document.
            const signature = JSON.stringify({ ...next, nodes: next.nodes.map(({ selected: _selected, ...node }) => node) })
            if (signature === last) return
            last = signature
            current.current.onCommit(next.nodes, next.edges, next.viewport)
        })
        return () => {
            unsubscribe()
            element.remove()
            canvas.current = null
        }
    }, [])

    useEffect(() => {
        const element = canvas.current
        if (!element) return
        syncing.current = true
        // Keep selection when authoritative DSL/layout updates arrive.
        const selected = new Set(element.store.getSelection())
        element.setGraph(toInternetMattGraph(props.nodes, props.edges, props.viewport))
        if (selected.size) element.store.select([...selected])
        element.dataset.theme = props.theme
        syncing.current = false
    }, [props.nodes, props.edges, props.viewport, props.theme])

    return <div ref={host} className='internetmatt-canvas' />
}
