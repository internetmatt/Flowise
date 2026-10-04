/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_PROJECTO_OPERATOR_API_KEY?: string
    readonly VITE_PROJECTO_INFERENCE_BASE?: string
}

declare module 'elkjs/lib/elk.bundled.js' {
    export default class ELK {
        layout(graph: unknown): Promise<{
            children?: Array<{ id: string; x?: number; y?: number; width?: number; height?: number }>
        }>
    }
}
