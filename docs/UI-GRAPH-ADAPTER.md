# Internet Matt UI and graph integration

Inspection baseline: IdeaFlow main `d23f5e92`, Projecto source paths linked below, and the standalone design-tokens repository. This assessment accompanies an optional flowchart canvas/token prototype on `experiment/internetmatt-studio-variant`; main and the default renderer are preserved.

| Layer | Internet Matt / Projecto | IdeaFlow today |
| --- | --- | --- |
| Visual editor | `@internetmatt/flow-canvas`: web components, Shadow DOM nodes, Canvas2D edges | React Flow inside `packages/diagram`; an additional MUI/React Flow agentflow package |
| Page declarations | `@internetmatt/declarative-ui`: JSON pages, component registries, runtime helpers | React routes and components; architecture intends a DeerFlow product shell |
| Visual tokens | `@internetmatt/design-tokens`: canonical `tokens.yaml`, generated CSS variables and TS helpers | Studio CSS literals; agentflow/observe keep separate local token objects |
| Executable definition | `FlowDeclaration`: registry node IDs, named ports, triggers, params, credential refs, retry/error policies, origin and lens | Flowise node component payloads (`data.name`, `inputs`, etc.) inside persisted `flowData` |
| Diagram document | Canvas graph has nodes, edges, handles and viewport; declarations can carry z/layer | `ideaflow-diagram/v1`: family, DSL, nodes, edges and viewport |
| Runtime | Projecto flow engine dispatches executor bindings | IdeaFlow server executes Flowise chatflows/agentflows |

## Proposed migration

1. Import the published design-token CSS and map semantic tokens into studio styles and MUI themes. Cover light/dark mode and focus, status, contrast and edge visibility. Remove duplicate token definitions only once their consumers have migrated.
2. Adapt Internet Matt UI components and declarative registries for IdeaFlow's shell, panels and inspectors. Keep IdeaFlow routes, tenant sessions, permissions, persistence and server inference proxy. The existing architecture identifies DeerFlow as the product-shell foundation; shared components can serve that shell.
3. Pilot `@internetmatt/flow-canvas` on the picture-diagram route behind a feature flag. Keep Mermaid parsing, diagram family handlers and ELK layout independent of the renderer. Check pan/zoom, drag/connect, selection, export and collaboration before making it the default.
4. Add a lossless agent editor adapter before switching executable graphs. Preserve original component payloads, input definitions, source/target handles, nested node metadata and viewport. Rendering a node with the same label does not establish execution equivalence.
5. Keep Projecto orchestration declarations native. A separate explicit bridge can invoke an IdeaFlow graph; changing IdeaFlow's renderer does not require adopting Projecto's engine or persistence.

## Adapter checks

The existing diagram edge serializer retains only id/source/target/label. It cannot serve as a lossless bridge for the richer Flowise edge shape (handles, type, data) or Projecto's named-port edges. Extend/version the boundary or preserve the native document alongside its editable projection; do not silently discard fields.

Required checks for a replacement: old and new documents round-trip without lost fields; condition/loop ports retain behavior; model/tool/credential references survive edits; tenant authorization and server-only inference credentials remain intact; save/reload, collaboration and exports work with both renderers. The live signaling compatibility test is not an agent execution-parity test.

`flow-canvas` documents working pan/zoom, connections, drag/select, minimap and save/restore. Its README still marks live pulse open and palette/helper-lines/stress work planned; inspect implementation and verify these capabilities before replacing current UX. `declarative-ui/package.json` still contains workspace/catalog resolutions, so a standalone consumer needs portable published dependency versions or split registries.

## Sources

- [Flow canvas](https://github.com/internetmatt/projecto/tree/main/libs/flow-canvas)
- [Canvas graph types](https://github.com/internetmatt/projecto/blob/main/libs/flow-canvas/src/core/types.ts)
- [Flow declarations](https://github.com/internetmatt/projecto/blob/main/libs/flow-declarations/src/index.ts)
- [Declarative UI](https://github.com/internetmatt/projecto/tree/main/libs/declarative-ui)
- [Standalone design tokens](https://github.com/internetmatt/design-tokens)
- [IdeaFlow architecture](./IDEAFLOW-ARCHITECTURE.md)
- [IdeaFlow diagram schema](../packages/diagram/src/schema.ts)
- [Flowise agent data types](../packages/agentflow/src/core/types/flow.ts)

## Branch validation

The diagram suite passes all 36 tests, including two adapter regressions. The production live test checks both renderer variants: diagram save/reload, changed viewport, agent listing and legacy signaling. Variant checks add dragging, Backspace isolation in the DSL field, light/dark switching and switching back to React Flow without rewriting the persisted document. Type checking and changed adapter/component lint pass.

The pilot imports pinned source snapshots because public npm returned 404 for the shared packages. It does not yet consume the full declarative-ui runtime or change executable agent semantics. See [snapshot provenance](../packages/diagram/src/vendor/README.md).
