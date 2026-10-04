import type { DiagramEdge, DiagramNode } from '../schema'

/** A named rule set. The id is the book. Rules are the book's own required parts, not an invented code. */
export type SchematicBook = {
    id: string
    requireNodes: string[]
    requireEdges: Array<{ source: string; target: string }>
}

export type BookCheck = {
    book: string
    pass: boolean
    failures: string[]
}

export function isTypeCheckerNode(node: DiagramNode): boolean {
    return node.data?.role === 'type-checker' || node.data?.shape === 'checker'
}

export function checkSchematicBook(nodes: DiagramNode[], edges: DiagramEdge[], book: SchematicBook | null | undefined): BookCheck {
    const id = book?.id?.trim() ?? ''
    if (!id) return { book: '', pass: false, failures: ['book unnamed'] }
    const failures: string[] = []
    const nodeIds = new Set(nodes.filter((node) => !isTypeCheckerNode(node)).map((node) => node.id))
    for (const required of book?.requireNodes ?? []) {
        if (!nodeIds.has(required)) failures.push(`missing node ${required}`)
    }
    for (const required of book?.requireEdges ?? []) {
        const found = edges.some((edge) => edge.source === required.source && edge.target === required.target)
        if (!found) failures.push(`missing edge ${required.source}->${required.target}`)
    }
    return { book: id, pass: failures.length === 0, failures }
}

/** The connector node names the book. Parts are every other node. */
export function runTypeChecker(nodes: DiagramNode[], edges: DiagramEdge[], books: SchematicBook[]): BookCheck {
    const connector = nodes.find(isTypeCheckerNode)
    const bookId = typeof connector?.data?.book === 'string' ? connector.data.book.trim() : ''
    if (!bookId) return { book: '', pass: false, failures: ['book unnamed'] }
    const book = books.find((item) => item.id === bookId)
    if (!book) return { book: bookId, pass: false, failures: [`book ${bookId} not loaded`] }
    return checkSchematicBook(nodes, edges, book)
}
