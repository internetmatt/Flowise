# IdeaFlow: Ideus packaging

IdeaFlow (formerly OpenIdeas) is the Ideus visual-agent canvas. **Origin (what we change):** [github.com/internetmatt/IdeaFlow](https://github.com/internetmatt/IdeaFlow). Apache-2.0 upstream is FlowiseAI/Flowise; do not ship the product as “Flowise.”

The name OpenIdeas now means the portable ideas-inbox format, not this repository. See [the OpenIdeas inbox plan](./plans/2026-10-06-openideas-inbox.md).

Local checkout: `upstreams/IdeaFlow` (chatflows + `@flowiseai/agentflow` React canvas) in parallel with AskDilly-Core.

## Docs this repo owns

| Surface             | Path                                                                                 | Published to VitePress?                      |
| ------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------- |
| This packaging card | `docs/IDEUS-PACKAGING.md`                                                            | Yes — synced to `/family/openideas`          |
| Core schema adapter | `packages/server/src/ideus-core/`                                                    | **No** (stay here; Core copies the contract) |
| Package READMEs     | `packages/agentflow/README.md`, `packages/ui/README.md`, `packages/server/README.md` | **No** (stay here)                           |
| Root README         | `README.md`                                                                          | No                                           |

The GitBook **rewrite source** on this site lives under `/flowise/` (synced from `upstreams/FlowiseDocs`). Pages there still say Flowise because they are Apache-2.0 upstream text. Product name is **IdeaFlow**. Licenses: AskDilly-Core VitePress `/licenses/`.

## Local

Ideus sibling port map (do not collide with Marketing UI `:3005` or Ideas `:3011`):

| Surface                                         | URL / port            |
| ----------------------------------------------- | --------------------- |
| IdeaFlow primary                                | http://localhost:3010 |
| IdeaFlow whitelabel                             | :3013                 |
| Upstream Flowise default (avoid on this laptop) | :3000                 |

`packages/server` still _falls back_ to `:3000` if `PORT` is unset (upstream binary). Env examples and [`docs/env.ideus.example`](./env.ideus.example) default **`PORT=3010`**. Prefer that when Core, Ideas, and Atlas are also running.

## Core canvas swap (`wt-flowise-replacement`)

AskDilly-Core stores `{ engine: 'flowise', externalFlowId }` on the workflow row and proxies `/rest/flowise/*` to `${IDEUS_FLOWISE_BASE_URL}/api/v1`. Point that URL at this process, not `flowiseai/flowise:3.1.2` on `:3300`.

```bash
# Core worktree
IDEUS_FLOWISE_BASE_URL=http://localhost:3010
IDEUS_FLOWISE_API_KEY=<IdeaFlow workspace key, server-side only>
```

Mapping types live in [`packages/server/src/ideus-core/`](../packages/server/src/ideus-core/README.md). `engine: 'flowise'` is a wire name until Core ships a rename PR.

## Design tokens

Figma catalog id: `openideas`. Agentflow / observe primaries use AskDilly-Core `--color--dilly-orange-500` (`#f99334`). Sources under `packages/agentflow/src/core/theme/tokens.ts`. Snapshot + bridge live in sibling **Core-Framework**. Cloud file: [Ideus Studio](https://www.figma.com/design/ttvYCRmdUkdGSPQEWhSbQG).

## Publish boundary

-   **Do** keep this packaging card for VitePress sync.
-   **Do not** vendor the GitBook into Ideus Wiki as customer docs.
-   **No OpenAPI** from this repo is on the VitePress allowlist.

Aggregator: sibling `AskDilly-Core/docs` (`pnpm docs:sync-family`).
