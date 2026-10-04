import type { DiagramDocument } from '../schema'

export const BOOK_SCHEMA = 'ideaflow-schematic-book/v1' as const

export type SchematicBook = {
    schema: typeof BOOK_SCHEMA
    id: string
    title?: string
    parts: Record<string, { kind?: string }>
    edges?: Array<{ from: string; to: string }>
}

export type CheckResult = {
    pass: boolean
    book: string
    failures: string[]
}

export function parseBook(value: unknown): SchematicBook {
    if (!value || typeof value !== 'object') throw new Error('book is not an object')
    const record = value as Partial<SchematicBook>
    if (record.schema !== BOOK_SCHEMA) {
        throw new Error(`Unsupported book schema: ${String(record.schema)}`)
    }
    const id = typeof record.id === 'string' ? record.id.trim() : ''
    if (!id) throw new Error('book is unnamed')
    if (!record.parts || typeof record.parts !== 'object') throw new Error('book has no parts')
    return {
        schema: BOOK_SCHEMA,
        id,
        title: typeof record.title === 'string' ? record.title : undefined,
        parts: record.parts,
        edges: Array.isArray(record.edges) ? record.edges : undefined
    }
}

function partName(document: DiagramDocument, nodeId: string): string {
    const node = document.nodes.find((item) => item.id === nodeId)
    return node?.data?.label || nodeId
}

export function checkSchematic(document: DiagramDocument, bookInput: unknown): CheckResult {
    const book = parseBook(bookInput)
    const failures: string[] = []
    if (document.family !== 'schematic') {
        failures.push(`family is ${document.family}, expected schematic`)
    }
    for (const node of document.nodes) {
        const name = node.data?.label || node.id
        if (!book.parts[name] && !book.parts[node.id]) {
            failures.push(`unknown part ${name}`)
        }
    }
    if (book.edges) {
        const allowed = new Set(book.edges.map((edge) => `${edge.from}->${edge.to}`))
        for (const edge of document.edges) {
            const from = partName(document, edge.source)
            const to = partName(document, edge.target)
            const byLabel = `${from}->${to}`
            const byId = `${edge.source}->${edge.target}`
            if (!allowed.has(byLabel) && !allowed.has(byId)) {
                failures.push(`edge ${byLabel} is not in book ${book.id}`)
            }
        }
    }
    return { pass: failures.length === 0, book: book.id, failures }
}
