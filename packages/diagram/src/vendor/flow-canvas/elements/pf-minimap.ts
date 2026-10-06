import { graphBounds } from '../render/edge-layer.ts'
import type { FlowNode, Viewport } from '../core/types.ts'
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from '../core/types.ts'

export class PfMinimap extends HTMLElement {
    #canvas: HTMLCanvasElement | null = null

    connectedCallback(): void {
        if (!this.#canvas) {
            this.#canvas = document.createElement('canvas')
            this.appendChild(this.#canvas)
        }
    }

    paint(nodes: FlowNode[], viewport: Viewport, hostW: number, hostH: number): void {
        if (!this.#canvas) return
        const rect = this.getBoundingClientRect()
        const w = Math.max(1, Math.floor(rect.width))
        const h = Math.max(1, Math.floor(rect.height))
        const dpr = devicePixelRatio || 1
        this.#canvas.width = w * dpr
        this.#canvas.height = h * dpr
        const ctx = this.#canvas.getContext('2d')
        if (!ctx) return
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)

        const bounds = graphBounds(nodes)
        const bw = Math.max(1, bounds.maxX - bounds.minX)
        const bh = Math.max(1, bounds.maxY - bounds.minY)
        const pad = 8
        const scale = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh)
        const ox = (w - bw * scale) / 2 - bounds.minX * scale
        const oy = (h - bh * scale) / 2 - bounds.minY * scale

        ctx.fillStyle = getComputedStyle(this).getPropertyValue('--pf-primary') || '#0078d4'
        for (const n of nodes) {
            if (n.hidden) continue
            const nw = (n.width ?? DEFAULT_NODE_WIDTH) * scale
            const nh = (n.height ?? DEFAULT_NODE_HEIGHT) * scale
            ctx.globalAlpha = 0.55
            ctx.fillRect(ox + n.position.x * scale, oy + n.position.y * scale, nw, nh)
        }
        ctx.globalAlpha = 1

        // Viewport rectangle in flow space
        const flowX = -viewport.x / viewport.zoom
        const flowY = -viewport.y / viewport.zoom
        const flowW = hostW / viewport.zoom
        const flowH = hostH / viewport.zoom
        ctx.strokeStyle = getComputedStyle(this).getPropertyValue('--pf-primary') || '#0078d4'
        ctx.lineWidth = 1.5
        ctx.strokeRect(ox + flowX * scale, oy + flowY * scale, flowW * scale, flowH * scale)
    }
}

export function definePfMinimap(): void {
    if (!customElements.get('pf-minimap')) {
        customElements.define('pf-minimap', PfMinimap)
    }
}
