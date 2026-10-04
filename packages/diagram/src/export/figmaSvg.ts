import type { DiagramDocument, DiagramNode } from '../schema'

/** Editable SVG with named layers for Figma import. No Figma API. */
export function exportFigmaSvg(document: DiagramDocument): string {
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

    const edgeGroup = document.edges
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
            const name = `edge-${edge.source}-${edge.target}`
            return `<g id="${escapeXml(name)}" data-name="${escapeXml(
                name
            )}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#3d4a3e" stroke-width="1.5" marker-end="url(#ideaflow-arrow)" />${label}</g>`
        })
        .join('')

    const nodeGroup = nodes
        .map((node) => {
            const w = widthOf(node)
            const h = heightOf(node)
            const x = node.position.x
            const y = node.position.y
            const layerName = `node-${node.id}`
            return `<g id="${escapeXml(layerName)}" data-name="${escapeXml(
                layerName
            )}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="#f4f7f2" stroke="#1f6b4a" stroke-width="1.5" /><text x="${
                x + w / 2
            }" y="${y + h / 2}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="14">${escapeXml(
                node.data.label || node.id
            )}</text></g>`
        })
        .join('')

    return [
        '<?xml version="1.0" encoding="UTF-8"?>',
        `<svg xmlns="http://www.w3.org/2000/svg" xmlns:figma="https://www.figma.com" width="${maxX}" height="${maxY}" viewBox="0 0 ${maxX} ${maxY}">`,
        '<defs><marker id="ideaflow-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#3d4a3e" /></marker></defs>',
        '<g id="Background" data-name="Background"><rect width="100%" height="100%" fill="#ffffff" /></g>',
        `<g id="Edges" data-name="Edges">${edgeGroup}</g>`,
        `<g id="Nodes" data-name="Nodes">${nodeGroup}</g>`,
        '</svg>'
    ].join('')
}

/** Layer names present in a Figma SVG (group id / data-name). */
export function listFigmaLayerNames(svg: string): string[] {
    const names = new Set<string>()
    const re = /<(?:g)\s+[^>]*?(?:id|data-name)="([^"]+)"/g
    let match: RegExpExecArray | null
    while ((match = re.exec(svg))) {
        names.add(match[1])
    }
    // Also catch the second attribute when both id and data-name are present
    const dataName = /data-name="([^"]+)"/g
    while ((match = dataName.exec(svg))) {
        names.add(match[1])
    }
    return [...names]
}

function escapeXml(value: string): string {
    return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
}
