import type { FlowNode } from '../core/types.ts'
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from '../core/types.ts'
import { definePfHandle } from './pf-handle.ts'

export class PfNode extends HTMLElement {
    #labelEl: HTMLSpanElement | null = null
    #pulseClear: ReturnType<typeof setTimeout> | null = null

    connectedCallback(): void {
        definePfHandle()
        if (!this.#labelEl) {
            this.#labelEl = document.createElement('span')
            this.#labelEl.className = 'pf-node__label'
            this.#labelEl.style.cssText =
                'display:block;padding:10px 14px;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
            this.appendChild(this.#labelEl)

            const left = document.createElement('pf-handle')
            left.setAttribute('data-position', 'left')
            left.setAttribute('data-handle-id', 'left')
            const right = document.createElement('pf-handle')
            right.setAttribute('data-position', 'right')
            right.setAttribute('data-handle-id', 'right')
            this.appendChild(left)
            this.appendChild(right)
        }
        this.setAttribute('role', 'group')
    }

    /**
     * Live run pulse (S2). `state` mirrors FlowRunState from integration-bridge.
     * Clears previous timer so rapid events keep the ring visible.
     */
    setRunPulse(state: string, ttlMs = 1600): void {
        if (this.#pulseClear) clearTimeout(this.#pulseClear)
        this.setAttribute('data-run-state', state)
        this.setAttribute('data-pulse', '')
        this.#pulseClear = setTimeout(() => {
            this.removeAttribute('data-pulse')
            this.#pulseClear = setTimeout(() => {
                this.removeAttribute('data-run-state')
                this.#pulseClear = null
            }, 400)
        }, ttlMs)
    }

    applyModel(node: FlowNode): void {
        this.dataset.nodeId = node.id
        this.dataset.type = node.type ?? 'default'
        if (node.selected) this.setAttribute('selected', '')
        else this.removeAttribute('selected')
        if (node.hidden) this.hidden = true
        else this.hidden = false

        const w = node.width ?? DEFAULT_NODE_WIDTH
        const h = node.height ?? DEFAULT_NODE_HEIGHT
        this.style.width = `${w}px`
        this.style.height = `${h}px`
        this.style.transform = `translate(${node.position.x}px, ${node.position.y}px)`
        this.style.left = '0'
        this.style.top = '0'

        for (const handle of this.querySelectorAll('pf-handle')) {
            handle.setAttribute('data-node-id', node.id)
        }

        if (this.#labelEl) {
            this.#labelEl.textContent = node.label ?? node.id
        }
        this.setAttribute('aria-label', node.label ?? node.id)
    }
}

export function definePfNode(): void {
    if (!customElements.get('pf-node')) {
        customElements.define('pf-node', PfNode)
    }
}
