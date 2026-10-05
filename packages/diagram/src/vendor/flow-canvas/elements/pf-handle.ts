export class PfHandle extends HTMLElement {
  static get observedAttributes(): string[] {
    return ['data-position', 'data-handle-id', 'data-node-id'];
  }

  connectedCallback(): void {
    if (!this.hasAttribute('role')) this.setAttribute('role', 'button');
    if (!this.hasAttribute('aria-label')) {
      this.setAttribute('aria-label', `Handle ${this.position}`);
    }
  }

  get position(): 'left' | 'right' | 'top' | 'bottom' {
    const p = this.getAttribute('data-position');
    if (p === 'left' || p === 'right' || p === 'top' || p === 'bottom') return p;
    return 'right';
  }

  get handleId(): string {
    return this.getAttribute('data-handle-id') ?? this.position;
  }

  get nodeId(): string {
    return this.getAttribute('data-node-id') ?? '';
  }
}

export function definePfHandle(): void {
  if (!customElements.get('pf-handle')) {
    customElements.define('pf-handle', PfHandle);
  }
}
