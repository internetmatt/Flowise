# Experimental source snapshots

These snapshots make the branch runnable without a private registry or a dependency on the full Projecto workspace. Replace them with portable published packages before promoting this experiment.

- `flow-canvas/`: runtime dependency closure of `libs/flow-canvas/src/elements/register.ts` and `styles.css` from `internetmatt/projecto` at `d1117afefe01c8ca122b620cfb689e670866a1d7`. Upstream package name `@internetmatt/flow-canvas`, version `0.1.0`, declared license MIT.
- `design-tokens.css`: generated `src/tokens.css` from `internetmatt/design-tokens` at `3c914a321ef886b96f590c0ce85c65674f8ee73c`, blob `fa7b46fd42b4c56cb8dbd82426e86f955c9d1309`. Upstream declares MIT. Canonical authoring belongs in that repository's `tokens.yaml`, not this snapshot.

Local canvas changes: controls/minimap pointer events are excluded from canvas gestures so native buttons receive clicks; keyboard shortcuts are limited to the canvas and skip text-entry controls, so selected nodes cannot be deleted by Backspace while editing the DSL or inspector. No Projecto engine, auth service, runtime API, or operator credentials are included.

The first adapter supports flowchart documents only. It preserves IdeaFlow node payloads but uses the upstream canvas's rectangular nodes and left/right handles; full Mermaid shape/direction parity and the richer agent port model remain future work. The original React Flow renderer remains available.
