import mermaid from 'mermaid'

let ready = false

/** Browser check that the DSL is Mermaid, after the flowchart parser has already structured it. */
export async function validateMermaid(dsl: string): Promise<void> {
    if (!ready) {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
        ready = true
    }
    await mermaid.parse(dsl)
}
