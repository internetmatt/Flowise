import { createRoot, type Root } from 'react-dom/client'
import { DiagramStudio } from './studio/DiagramStudio'
import '@xyflow/react/dist/style.css'
import './studio/studio.css'

export type DiagramMountProps = {
    flowData: string
    assetBase?: string
    gateway?: { baseUrl?: string }
    signalingBase?: string
    diagramId?: string
    onSave?: (flowData: string) => void | Promise<void>
    onChange?: (flowData: string) => void
}

const roots = new WeakMap<HTMLElement, { root: Root; props: DiagramMountProps }>()

export function mount(element: HTMLElement, props: DiagramMountProps) {
    let entry = roots.get(element)
    if (!entry) {
        entry = { root: createRoot(element), props }
        roots.set(element, entry)
    }
    entry.props = props
    entry.root.render(<DiagramStudio {...props} />)
    return {
        update(next: DiagramMountProps) {
            mount(element, next)
        },
        unmount() {
            unmount(element)
        }
    }
}

export function unmount(element: HTMLElement) {
    const entry = roots.get(element)
    if (!entry) return
    entry.root.unmount()
    roots.delete(element)
}
