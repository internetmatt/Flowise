# IdeaFlow diagram studio

Date: 2026-09-27
Status: approved direction (borrow editor technique; keep the Flowise runtime)

## Goal

IdeaFlow keeps chatflows and agentflows executable. The same app also draws, exports, and generates technical diagrams:

-   Families: flowchart, architecture, ER, class, sequence, state, mindmap, journey, and the existing agent graph
-   Export: SVG, PNG, Mermaid, JSON, Figma-ready SVG, and cinematic MP4
-   Generation: diagram DSL from a prompt, via the Projecto inference gateway (`:4716`)
-   Live edit: opt-in WebRTC collaboration on a diagram
-   Run: the agent family executes through the current Flowise runtime

## Constraint

Do not replace the IdeaFlow runtime with OpenFlowKit. Picture families (flowchart through journey) are documents. The agent family is the same component graph the executor already runs, drawn on XYFlow 12.

Early slices do not touch `packages/ui` or `@flowiseai/agentflow` on `reactflow` 11. The migration slice moves `/v2/agentcanvas` onto `@openideas/diagram`. It does not upgrade React Flow inside the old canvas.

OpenFlowKit (`Vrun-design/openflowkit`, MIT, 0.1.1) is the technique source for the editor: XYFlow 12, ELK in a worker, Mermaid round-trip, Figma SVG, WebCodecs MP4, and Yjs over WebRTC. Copy and adapt those pieces. Do not vendor the SPA, marketing site, PostHog, or its provider keyring.

## Document model

Add chatflow type `DIAGRAM` next to `CHATFLOW`, `AGENTFLOW`, `MULTIAGENT`, and `ASSISTANT`.

`ChatFlow.flowData` for this type is a versioned blob, not a component graph:

```json
{
    "schema": "ideaflow-diagram/v1",
    "family": "flowchart",
    "dsl": "flowchart TD\n  A --> B",
    "nodes": [],
    "edges": [],
    "viewport": { "x": 0, "y": 0, "zoom": 1 }
}
```

`family` is one of `flowchart`, `architecture`, `er`, `class`, `sequence`, `state`, `mindmap`, `journey`, `schematic`, `agent`.

**2026-10-04:** `schematic` still uses ELK `layered` (elkjs has no `orthogonal` algorithm) and sets `elk.edgeRouting` to `ORTHOGONAL`. Other picture families stay layered without that routing. The type-checker connector reads a named `ideaflow-schematic-book/v1` book (`ideaflow-parts-v1` fixture). That book is not a building or electrical code.

The server stores and returns the blob through the existing chatflow API. `buildChatflow` and prediction refuse every family except `agent`. An `agent` document's nodes are the existing agentflow component nodes, and prediction runs them through the current executor.

Update the type union in:

-   `packages/server/src/Interface.ts` (`ChatflowType`)
-   `packages/server/src/database/entities/ChatFlow.ts` (`EnumChatflowType`)
-   `packages/ideas-contract/src/index.ts` (`FLOWISE_FLOW_TYPES`)

`varchar(20)` already fits `DIAGRAM`.

## Editor package

New workspace package `packages/diagram` (`@openideas/diagram`):

-   React 19, Vite, `@xyflow/react` 12, `elkjs`, `mermaid`
-   Own bundle. `packages/ui` loads it on the diagram route as a separate entry, the same way the canvas island stays off the Ideas UI libs
-   Zustand inside the package only. Redux in `flowise-ui` keeps owning the chatflow record (id, name, workspace, save)

Save path: editor emits the v1 blob; the existing chatflow update writes `flowData`. Gateway credentials are not part of that payload.

## Generation

One client inside `@openideas/diagram`. It speaks the OpenAI chat-completions API on the Projecto inference gateway:

-   `POST {base}/v1/chat/completions`
-   `GET {base}/v1/models` for the model list
-   Default base `http://127.0.0.1:4716/v1`
-   `Authorization: Bearer` is the operator key the Projecto host already uses for `:4716` (`PROJECTO_OPERATOR_API_KEY`). The diagram package does not collect vendor keys.

The gateway owns lanes (`projecto/*` local vLLM, `pinternet/*`, and the rest of its routing). The panel picks a model from `/v1/models`. It does not call Ollama, vLLM `:8000`, or a third-party provider directly.

The model returns DSL. The package parses it, lays it out, and writes nodes, edges, and `dsl` into the document. A parse failure is shown in the panel; the previous canvas is left in place. The operator key is not written to `chat_flow` or the IdeaFlow credentials store.

## Layout and round-trip

-   ELK runs in a web worker
-   Editing the canvas updates `dsl`. Editing `dsl` updates the canvas
-   Mermaid import and export use the same DSL for the families that have a parser
-   v1 round-trip target is flowchart. Other families render and export JSON/SVG first, then gain DSL round-trip in later slices

## Export

Client-side only, from the diagram package:

-   SVG
-   PNG
-   Mermaid text (families that have a serializer)
-   JSON (the v1 blob)

No server render for SVG, PNG, or Mermaid.

### Figma

Export an editable SVG with layers preserved, from the same client-side export path. No Figma account and no Figma API.

### Cinematic MP4

Client-side walkthrough of the current diagram: WebCodecs `VideoEncoder` plus an in-browser MP4 muxer, with MediaRecorder as the fallback. No upload.

### WebRTC collaboration

Opt-in Yjs session over WebRTC for one open diagram. The IdeaFlow server is the signaling endpoint. Peers sync the v1 blob live. The durable copy is still `flowData` on save. Off unless the session is started. No WebRTC on chatflow or agent execution.

## Agent family

`family: "agent"` is the agentflow node contract on the XYFlow 12 canvas: Start, Agent, LLM, Condition, Tool, and the rest of today's agentflow palette. Save writes that component graph inside the v1 blob. Prediction reads it and calls the existing executor.

`/v2/agentcanvas` mounts this family. The React Flow 11 agent canvas comes off that route in the same slice. Chatflow (`/canvas`) stays on React Flow 11 until a later decision.

A picture family does not execute. Turning one into a run means an explicit compile into an `agent` document, then prediction on that document.

## Slices

1. `DIAGRAM` type, empty canvas, save and reload the v1 blob. Prediction refuses every family except `agent`.
2. Flowchart on XYFlow 12 with Mermaid round-trip, ELK worker, SVG/PNG/Mermaid/JSON export
3. Generation through `:4716` (`/v1/chat/completions` and `/v1/models`)
4. Remaining picture families: architecture, then ER, class, state, sequence, mindmap, journey
5. Figma SVG export and cinematic MP4
6. Opt-in WebRTC collaboration on a diagram document
7. Agent family on XYFlow 12, `/v2/agentcanvas` cut over, prediction runs the existing executor

## Non-goals

-   Ollama, a browser keyring, or direct calls to Gemini, OpenAI, Anthropic, Groq, Mistral, NVIDIA, Cerebras, or OpenRouter
-   Replacing `buildChatflow` with an OpenFlowKit runtime
-   WebRTC on chat execution
-   A silent compile from a picture family into a running agent
