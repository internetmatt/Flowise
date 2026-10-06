export type ControlsAction = 'zoom-in' | 'zoom-out' | 'fit' | 'lock'

export class PfControls extends HTMLElement {
    #onAction: ((action: ControlsAction) => void) | null = null

    connectedCallback(): void {
        if (this.childElementCount > 0) return
        this.replaceChildren(
            this.#btn('+', 'zoom-in', 'Zoom in'),
            this.#btn('−', 'zoom-out', 'Zoom out'),
            this.#btn('⊡', 'fit', 'Fit view')
        )
    }

    set onAction(handler: ((action: ControlsAction) => void) | null) {
        this.#onAction = handler
    }

    #btn(label: string, action: ControlsAction, aria: string): HTMLButtonElement {
        const b = document.createElement('button')
        b.type = 'button'
        b.textContent = label
        b.setAttribute('aria-label', aria)
        b.addEventListener('click', (e) => {
            e.stopPropagation()
            this.#onAction?.(action)
        })
        return b
    }
}

export function definePfControls(): void {
    if (!customElements.get('pf-controls')) {
        customElements.define('pf-controls', PfControls)
    }
}
