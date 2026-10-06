import { createFlowStore, type FlowStore } from '../core/store.ts'
import { fitView, screenToFlow, viewportTransform, zoomAt } from '../core/viewport.ts'
import type { FlowGraph, FlowPoint, HandleRef } from '../core/types.ts'
import { paintEdgeLayer } from '../render/edge-layer.ts'
import { PfControls, definePfControls, type ControlsAction } from './pf-controls.ts'
import { PfMinimap, definePfMinimap } from './pf-minimap.ts'
import { PfNode, definePfNode } from './pf-node.ts'
import { PfHandle, definePfHandle } from './pf-handle.ts'

type PointerMode = 'idle' | 'pan' | 'drag-node' | 'connect'

export class PfFlow extends HTMLElement {
    #store: FlowStore = createFlowStore()
    #unsub: (() => void) | null = null
    #canvas: HTMLCanvasElement | null = null
    #viewportEl: HTMLDivElement | null = null
    #controls: PfControls | null = null
    #minimap: PfMinimap | null = null
    #raf = 0
    #mode: PointerMode = 'idle'
    #pointerId: number | null = null
    #lastScreen: FlowPoint = { x: 0, y: 0 }
    #dragNodeId: string | null = null
    #dragOffset: FlowPoint = { x: 0, y: 0 }
    #spaceDown = false
    #ro: ResizeObserver | null = null

    static get observedAttributes(): string[] {
        return ['fit-view']
    }

    get store(): FlowStore {
        return this.#store
    }

    setGraph(graph: FlowGraph): void {
        this.#store.setGraph(graph)
        if (this.hasAttribute('fit-view')) {
            this.fitView()
        }
    }

    getGraph(): FlowGraph {
        return this.#store.toJSON()
    }

    fitView(): void {
        const rect = this.getBoundingClientRect()
        const vp = fitView(this.#store.getNodes(), {
            width: rect.width || 800,
            height: rect.height || 600,
            padding: 48
        })
        this.#store.setViewport(vp)
    }

    /**
     * Pulse a node (or best-effort match by id / label / skill key) for live
     * FlowRunEvents (S2 agent + hook exit).
     */
    pulseNode(nodeKey: string, state = 'running', ttlMs = 1600): string[] {
        const key = (nodeKey || '').trim()
        if (!key) return []
        const nodes = this.#store.getNodes()
        const matched = nodes.filter(
            (n) =>
                n.id === key ||
                n.label === key ||
                (typeof n.node === 'string' && n.node === key) ||
                key.includes(n.id) ||
                (n.label ? key.includes(n.label) : false)
        )
        const targets = matched.length > 0 ? matched : nodes.length ? [nodes[Math.abs(hashStr(key)) % nodes.length]] : []
        const hit: string[] = []
        for (const n of targets) {
            const el = this.#viewportEl?.querySelector(`pf-node[data-node-id="${CSS.escape(n.id)}"]`) as PfNode | null
            el?.setRunPulse(state, ttlMs)
            hit.push(n.id)
        }
        return hit
    }

    connectedCallback(): void {
        definePfHandle()
        definePfNode()
        definePfControls()
        definePfMinimap()

        this.#ensureDom()
        this.#unsub = this.#store.subscribe(() => this.#schedulePaint())
        this.#bindEvents()
        this.#ro = new ResizeObserver(() => this.#schedulePaint())
        this.#ro.observe(this)
        this.#schedulePaint()
    }

    disconnectedCallback(): void {
        this.#unsub?.()
        this.#unsub = null
        this.#ro?.disconnect()
        this.#ro = null
        cancelAnimationFrame(this.#raf)
        window.removeEventListener('keydown', this.#onKeyDown)
        window.removeEventListener('keyup', this.#onKeyUp)
    }

    #ensureDom(): void {
        if (this.#canvas) return

        this.#canvas = document.createElement('canvas')
        this.#canvas.className = 'pf-flow__edges'
        this.#canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;'

        this.#viewportEl = document.createElement('div')
        this.#viewportEl.className = 'pf-flow__viewport'
        this.#viewportEl.style.cssText = 'position:absolute;inset:0;transform-origin:0 0;will-change:transform;'

        this.#controls = document.createElement('pf-controls') as PfControls
        this.#controls.onAction = (a) => this.#onControls(a)

        this.#minimap = document.createElement('pf-minimap') as PfMinimap

        this.append(this.#canvas, this.#viewportEl, this.#controls, this.#minimap)
    }

    #bindEvents(): void {
        this.addEventListener('pointerdown', this.#onPointerDown)
        this.addEventListener('pointermove', this.#onPointerMove)
        this.addEventListener('pointerup', this.#onPointerUp)
        this.addEventListener('pointercancel', this.#onPointerUp)
        this.addEventListener('wheel', this.#onWheel, { passive: false })
        window.addEventListener('keydown', this.#onKeyDown)
        window.addEventListener('keyup', this.#onKeyUp)
    }

    #onKeyDown = (e: KeyboardEvent): void => {
        const target = e.target as HTMLElement | null
        if (!target || !this.contains(target) || target.closest('input, textarea, select, [contenteditable]')) return
        if (e.code === 'Space') this.#spaceDown = true
        if ((e.key === 'Delete' || e.key === 'Backspace') && this.#store.getSelection().size) {
            e.preventDefault()
            this.#store.removeNodes([...this.#store.getSelection()])
        }
    }

    #onKeyUp = (e: KeyboardEvent): void => {
        if (e.code === 'Space') this.#spaceDown = false
    }

    #onControls(action: ControlsAction): void {
        const vp = this.#store.getViewport()
        const rect = this.getBoundingClientRect()
        const center = { x: rect.width / 2, y: rect.height / 2 }
        if (action === 'zoom-in') this.#store.setViewport(zoomAt(vp, center, vp.zoom * 1.2))
        if (action === 'zoom-out') this.#store.setViewport(zoomAt(vp, center, vp.zoom / 1.2))
        if (action === 'fit') this.fitView()
    }

    #localPoint(e: PointerEvent | WheelEvent): FlowPoint {
        const rect = this.getBoundingClientRect()
        return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    #onWheel = (e: WheelEvent): void => {
        e.preventDefault()
        const vp = this.#store.getViewport()
        const anchor = this.#localPoint(e)
        const factor = e.deltaY > 0 ? 0.9 : 1.1
        this.#store.setViewport(zoomAt(vp, anchor, vp.zoom * factor))
    }

    #onPointerDown = (e: PointerEvent): void => {
        // Controls own their clicks; capturing the pointer here suppresses them.
        if ((e.target as Element | null)?.closest?.('pf-controls, pf-minimap')) return
        if (e.button === 1 || this.#spaceDown || e.button === 2) {
            this.#mode = 'pan'
            this.#pointerId = e.pointerId
            this.#lastScreen = this.#localPoint(e)
            this.setPointerCapture(e.pointerId)
            return
        }
        if (e.button !== 0) return

        const handle = (e.target as Element | null)?.closest?.('pf-handle') as PfHandle | null
        if (handle && handle.nodeId) {
            const flowPt = screenToFlow(this.#localPoint(e), this.#store.getViewport())
            const from: HandleRef = {
                nodeId: handle.nodeId,
                handleId: handle.handleId,
                position: handle.position
            }
            this.#mode = 'connect'
            this.#pointerId = e.pointerId
            this.#store.setConnection({ from, to: flowPt })
            this.setPointerCapture(e.pointerId)
            return
        }

        const nodeEl = (e.target as Element | null)?.closest?.('pf-node') as PfNode | null
        if (nodeEl?.dataset.nodeId) {
            const id = nodeEl.dataset.nodeId
            const node = this.#store.getNodes().find((n) => n.id === id)
            if (!node) return
            const flowPt = screenToFlow(this.#localPoint(e), this.#store.getViewport())
            this.#mode = 'drag-node'
            this.#dragNodeId = id
            this.#dragOffset = {
                x: flowPt.x - node.position.x,
                y: flowPt.y - node.position.y
            }
            this.#pointerId = e.pointerId
            this.#store.select([id], e.shiftKey)
            this.setPointerCapture(e.pointerId)
            return
        }

        this.#store.clearSelection()
        this.#mode = 'pan'
        this.#pointerId = e.pointerId
        this.#lastScreen = this.#localPoint(e)
        this.setPointerCapture(e.pointerId)
    }

    #onPointerMove = (e: PointerEvent): void => {
        if (this.#pointerId !== e.pointerId) return
        const screen = this.#localPoint(e)
        const vp = this.#store.getViewport()

        if (this.#mode === 'pan') {
            const dx = screen.x - this.#lastScreen.x
            const dy = screen.y - this.#lastScreen.y
            this.#lastScreen = screen
            this.#store.setViewport({ ...vp, x: vp.x + dx, y: vp.y + dy })
            return
        }

        if (this.#mode === 'drag-node' && this.#dragNodeId) {
            const flowPt = screenToFlow(screen, vp)
            this.#store.updateNode(this.#dragNodeId, {
                position: {
                    x: flowPt.x - this.#dragOffset.x,
                    y: flowPt.y - this.#dragOffset.y
                }
            })
            return
        }

        if (this.#mode === 'connect') {
            const conn = this.#store.getConnection()
            if (!conn) return
            this.#store.setConnection({
                from: conn.from,
                to: screenToFlow(screen, vp)
            })
        }
    }

    #onPointerUp = (e: PointerEvent): void => {
        if (this.#pointerId !== e.pointerId) return

        if (this.#mode === 'connect') {
            const conn = this.#store.getConnection()
            const handle = (e.target as Element | null)?.closest?.('pf-handle') as PfHandle | null
            // Also hit-test under pointer — capture may target the host
            const under = document.elementFromPoint(e.clientX, e.clientY)
            const targetHandle = handle ?? ((under as Element | null)?.closest?.('pf-handle') as PfHandle | null)

            if (conn && targetHandle?.nodeId && targetHandle.nodeId !== conn.from.nodeId) {
                const id = `e-${conn.from.nodeId}-${targetHandle.nodeId}-${Date.now().toString(36)}`
                this.#store.addEdge({
                    id,
                    source: conn.from.nodeId,
                    target: targetHandle.nodeId,
                    sourceHandle: conn.from.handleId,
                    targetHandle: targetHandle.handleId,
                    type: 'bezier'
                })
            }
            this.#store.setConnection(null)
        }

        this.#mode = 'idle'
        this.#pointerId = null
        this.#dragNodeId = null
        try {
            this.releasePointerCapture(e.pointerId)
        } catch {
            /* already released */
        }
    }

    #schedulePaint(): void {
        cancelAnimationFrame(this.#raf)
        this.#raf = requestAnimationFrame(() => this.#paint())
    }

    #paint(): void {
        if (!this.#canvas || !this.#viewportEl) return
        const rect = this.getBoundingClientRect()
        const w = Math.max(1, Math.floor(rect.width))
        const h = Math.max(1, Math.floor(rect.height))
        const dpr = devicePixelRatio || 1
        this.#canvas.width = w * dpr
        this.#canvas.height = h * dpr

        const ctx = this.#canvas.getContext('2d')
        if (!ctx) return

        const styles = getComputedStyle(this)
        const nodes = this.#store.getNodes()
        const edges = this.#store.getEdges()
        const viewport = this.#store.getViewport()

        paintEdgeLayer(ctx, {
            width: w,
            height: h,
            viewport,
            nodes,
            edges,
            connection: this.#store.getConnection(),
            colors: {
                edge: styles.getPropertyValue('--pf-text-muted').trim() || '#666',
                edgeSelected: styles.getPropertyValue('--pf-primary').trim() || '#0078d4',
                connection: styles.getPropertyValue('--pf-primary').trim() || '#0078d4',
                grid: 'rgba(0,0,0,0.06)'
            }
        })

        this.#viewportEl.style.transform = viewportTransform(viewport)
        this.#syncNodes(nodes)
        this.#minimap?.paint(nodes, viewport, w, h)
    }

    #syncNodes(nodes: ReturnType<FlowStore['getNodes']>): void {
        if (!this.#viewportEl) return
        const existing = new Map<string, PfNode>()
        for (const el of this.#viewportEl.querySelectorAll('pf-node')) {
            const id = (el as PfNode).dataset.nodeId
            if (id) existing.set(id, el as PfNode)
        }

        const seen = new Set<string>()
        for (const node of nodes) {
            seen.add(node.id)
            let el = existing.get(node.id)
            if (!el) {
                el = document.createElement('pf-node') as PfNode
                this.#viewportEl.appendChild(el)
            }
            el.applyModel(node)
        }

        for (const [id, el] of existing) {
            if (!seen.has(id)) el.remove()
        }
    }
}

export function definePfFlow(): void {
    if (!customElements.get('pf-flow')) {
        customElements.define('pf-flow', PfFlow)
    }
}

function hashStr(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return h
}
