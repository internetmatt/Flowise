import type { DiagramDocument, DiagramNode } from '../schema'

export function exportSvg(document: DiagramDocument): string {
    const nodes = document.nodes
    const widthOf = (node: DiagramNode) => node.width ?? Math.max(140, (node.data.label || node.id).length * 8 + 32)
    const heightOf = (node: DiagramNode) => node.height ?? 48
    const pad = 32
    let maxX = 320
    let maxY = 180
    for (const node of nodes) {
        maxX = Math.max(maxX, node.position.x + widthOf(node) + pad)
        maxY = Math.max(maxY, node.position.y + heightOf(node) + pad)
    }
    const byId = new Map(nodes.map((node) => [node.id, node]))
    const lines = document.edges
        .map((edge) => {
            const source = byId.get(edge.source)
            const target = byId.get(edge.target)
            if (!source || !target) return ''
            const x1 = source.position.x + widthOf(source) / 2
            const y1 = source.position.y + heightOf(source)
            const x2 = target.position.x + widthOf(target) / 2
            const y2 = target.position.y
            const label = edge.label
                ? `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}" text-anchor="middle" font-size="12">${escapeXml(edge.label)}</text>`
                : ''
            return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3d4a3e" stroke-width="1.5" marker-end="url(#ideaflow-arrow)" />${label}`
        })
        .join('')
    const shapes = nodes
        .map((node) => {
            const w = widthOf(node)
            const h = heightOf(node)
            const x = node.position.x
            const y = node.position.y
            return `<g id="node-${escapeXml(
                node.id
            )}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#f4f7f2" stroke="#1f6b4a" stroke-width="1.5" /><text x="${
                x + w / 2
            }" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">${escapeXml(
                node.data.label || node.id
            )}</text></g>`
        })
        .join('')
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}"><defs><marker id="ideaflow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#3d4a3e" /></marker></defs><rect width="100%" height="100%" fill="#ffffff" />${lines}${shapes}</svg>`
}

export function exportJson(document: DiagramDocument): string {
    return JSON.stringify(document, null, 2)
}

export function exportMermaid(document: DiagramDocument): string {
    return document.dsl
}

export async function exportPng(svg: string): Promise<Blob> {
    if (typeof document === 'undefined' || typeof Image === 'undefined') {
        throw new Error('PNG export runs in the browser')
    }
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    try {
        const image = new Image()
        image.decoding = 'sync'
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve()
            image.onerror = () => reject(new Error('Could not rasterize SVG'))
            image.src = url
        })
        const width = image.naturalWidth || 800
        const height = image.naturalHeight || 600
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Could not rasterize SVG')
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, width, height)
        context.drawImage(image, 0, 0)
        const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
        if (!png) throw new Error('Could not encode PNG')
        return png
    } finally {
        URL.revokeObjectURL(url)
    }
}

export function downloadBlob(filename: string, body: Blob | string, mime = 'text/plain'): void {
    const blob = body instanceof Blob ? body : new Blob([body], { type: mime })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
}

function escapeXml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
