import { describe, expect, it } from 'vitest'
import { exportJson, exportSvg } from '../export/exportDiagram'
import { tryApplyDsl } from '../document'
import { pictureFamilies } from './index'

const FIXTURES: Record<string, string> = {
    flowchart: `flowchart TD
  A[Start] --> B[End]
`,
    architecture: `architecture
  A[Frontend] --> B[API]
  B --> C[Database]
`,
    er: `erDiagram
  CUSTOMER ||--o{ ORDER : places
`,
    class: `classDiagram
  Animal <|-- Duck
  Animal --> Duck : uses
`,
    state: `stateDiagram-v2
  [*] --> Still
  Still --> Moving : go
`,
    sequence: `sequenceDiagram
  participant Alice
  participant Bob
  Alice->>Bob: Hello
`,
    mindmap: `mindmap
  root((Idea))
    Topic
      Detail
`,
    journey: `journey
  title My day
  section Home
    Wake up: 5: Me
    Make coffee: 3: Me
`
}

describe('picture families', () => {
    it.each(pictureFamilies().map((family) => family.id))('%s renders nodes and exports JSON/SVG', (familyId) => {
        const family = pictureFamilies().find((item) => item.id === familyId)!
        const dsl = FIXTURES[familyId]
        expect(dsl).toBeTruthy()
        const parsed = family.parseDsl(dsl)
        expect(parsed.nodes.length).toBeGreaterThan(0)

        const document = {
            ...family.emptyDocument(),
            dsl: parsed.dsl,
            nodes: parsed.nodes.map((node, index) => ({
                ...node,
                position: node.position.x || node.position.y ? node.position : { x: 40, y: 40 + index * 100 }
            })),
            edges: parsed.edges
        }

        const svg = exportSvg(document)
        expect(svg).toContain('<svg')
        expect(svg).toContain(document.nodes[0]!.data.label.split('\n')[0]!.slice(0, 4))

        const json = JSON.parse(exportJson(document))
        expect(json.schema).toBe('ideaflow-diagram/v1')
        expect(json.family).toBe(familyId)
        expect(json.nodes.length).toBe(document.nodes.length)

        if (family.hasDslRoundTrip) {
            const again = family.parseDsl(family.serialize(document.nodes, document.edges, document.dsl))
            expect(again.nodes.length).toBeGreaterThan(0)
            expect(again.edges.length).toBe(document.edges.length)
        }
    })

    it('keeps flowchart canvas apply working through the family registry', () => {
        const current = pictureFamilies()
            .find((family) => family.id === 'flowchart')!
            .emptyDocument()
        const applied = tryApplyDsl(current, FIXTURES.flowchart)
        expect(applied.error).toBeNull()
        expect(applied.document.nodes.map((node) => node.id)).toEqual(['A', 'B'])
    })
})
