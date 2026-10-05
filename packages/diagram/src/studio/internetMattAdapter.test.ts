import { describe, expect, it } from 'vitest'
import { fromInternetMattGraph, toInternetMattGraph } from './internetMattAdapter'
import type { DiagramEdge, DiagramNode } from '../schema'

describe('Internet Matt canvas projection', () => {
    it('preserves native payloads when moving a projected node', () => {
        const nodes: DiagramNode[] = [
            {
                id: 'A',
                type: 'flowchart',
                position: { x: 10, y: 20 },
                width: 180,
                data: { label: 'Start', shape: 'diamond', inputs: { model: 'model-ref' }, extra: { untouched: true } }
            }
        ]
        const edges = [
            { id: 'e', source: 'A', target: 'B', label: 'yes', sourceHandle: 'branch', extra: 'native' }
        ] as unknown as DiagramEdge[]
        const viewport = { x: 30, y: 40, zoom: 1.2 }
        const graph = toInternetMattGraph(nodes, edges, viewport)
        graph.nodes[0].position = { x: 90, y: 100 }
        graph.nodes[0].label = 'Renamed'
        const result = fromInternetMattGraph(graph, nodes, edges)
        expect(result.nodes[0]).toMatchObject({ ...nodes[0], position: { x: 90, y: 100 }, data: { ...nodes[0].data, label: 'Renamed' } })
        expect(result.edges).toEqual(edges)
        expect(result.viewport).toEqual(viewport)
        expect(nodes[0].position).toEqual({ x: 10, y: 20 })
        expect(nodes[0].data.label).toBe('Start')
    })
    it('projects deletion and new connections without reviving removed entities', () => {
        const nodes: DiagramNode[] = ['A', 'B', 'C'].map((id) => ({ id, position: { x: 0, y: 0 }, data: { label: id } }))
        const graph = toInternetMattGraph(nodes, [{ id: 'old', source: 'A', target: 'B' }], { x: 0, y: 0, zoom: 1 })
        graph.nodes = graph.nodes.filter((node) => node.id !== 'B')
        graph.edges = [{ id: 'new', source: 'A', target: 'C' }]
        const result = fromInternetMattGraph(graph, nodes, [])
        expect(result.nodes.map((node) => node.id)).toEqual(['A', 'C'])
        expect(result.edges).toEqual([{ id: 'new', source: 'A', target: 'C' }])
    })
})
