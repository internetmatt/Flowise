# Diagram review follow-up validation

Base: `e6ab9573c80276dca4e96480c6f51627d359180c` (PR #13).

| Finding                                          | Fix                                                                                                                                                                                                                        | Regression evidence                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1 operator key exposed in browser configuration | Remove host/Vite credential reads and the browser `apiKey` interface. A workspace-authorized server proxy reads `PROJECTO_OPERATOR_API_KEY` and sends it only to the configured Projecto gateway.                          | Server proxy tests cover workspace ownership, view/update permission, missing credentials, upstream bearer, redirects, input bounds and sanitized responses. Browser client tests verify session headers and absence of an Authorization bearer. No operator-key references occur in the built UI or diagram assets. |
| P1 diagram asset build race                      | Declare the diagram workspace as a UI build dependency; fail staging when `diagram.js` is missing; cache `build/**` for the UI. Add the missing diagram lockfile importer without changing existing workspace resolutions. | Staging tests pass. Turbo builds the diagram before the UI. After deleting both outputs, a cache-only build restores matching JS, CSS and worker assets.                                                                                                                                                             |
| P1 new v2 agents disappear from Agents           | Create new records as `AGENTFLOW`, retain that type when saving, and preserve explicitly typed legacy `DIAGRAM` records.                                                                                                   | Real browser creates, renames and saves an agent, then verifies its type through the API and its visibility in the Agents page/list endpoint.                                                                                                                                                                        |
| P2 existing AGENTFLOW rooms return 404           | Look up the record in the active workspace, admit DIAGRAM/AGENTFLOW only, and apply the corresponding chatflow/agentflow permission. Use the existing internal session transport for signaling.                            | Authorization and transport tests pass. A real legacy React Flow AGENTFLOW opens through `/v2/agentcanvas/:id`; Live joins successfully and room signaling delivers an envelope.                                                                                                                                     |
| P2 unbounded nonexistent-peer inboxes            | Require both peers to be joined; cap peers per room, each payload to 16 KiB and each inbox to 128 envelopes; expire envelopes after 30 seconds on send/poll.                                                               | Tests cover nonexistent rooms/senders/destinations, departed peers, queue/payload limits, expiry and capacity recovery. Real HTTP signaling to an unknown destination returns 404.                                                                                                                                   |

Live validation also found that Vite library mode left `process.env.NODE_ENV` in the directly loaded IIFE. The diagram build now defines only that non-secret production constant, without a process shim or environment serialization.

## Passing checks

-   Frozen lockfile installation with pnpm 10.26.0.
-   Focused server tests: 3 suites, 15 tests.
-   Diagram inference/signaling client tests: 2 suites, 4 tests.
-   Asset staging/dependency tests: 2 tests.
-   Existing UI Jest suite: 3 suites, 70 tests. The previously implicit Babel React preset is now an explicit, already-locked dev dependency.
-   ESLint on all changed source, test, script, configuration and documentation files; `git diff --check`.
-   Production diagram and UI builds, including cache restoration after removing their outputs.
-   Real production browser + SQLite validation through `scripts/validate-diagram-live.mjs`, with no intercepted/mocked APIs:
    -   Create a diagram, rename it, edit its DSL, zoom the viewport, save, reload `/diagram/:id`, and verify name/DSL/nodes/edges/viewport plus unchanged persisted flowData.
    -   Create/save an agent and verify `AGENTFLOW` identity and Agents-list visibility.
    -   Open a legacy AGENTFLOW, use its Live button, join two peers, exchange/poll a signal, and reject a nonexistent destination.
    -   Delete all three test records; the database contains zero remaining regression records.

The run used a disposable local OSS workspace and IdeaFlow's existing loopback identity resolution. It did not add an authentication bypass or inject operator credentials into the browser. Live Projecto inference itself was not available here; upstream token forwarding and fail-closed behavior were validated with focused server tests.

## Reproduce live checks

Start a production build against a disposable database, then run:

```sh
IDEAFLOW_URL=http://127.0.0.1:3000 node scripts/validate-diagram-live.mjs
```

The script uses the existing Playwright dependency from `packages/components`. `IDEAFLOW_BROWSER_PATH` and `IDEAFLOW_BROWSER_ARGS` can select an installed Chromium. For a remote authenticated test workspace, provide `IDEAFLOW_STORAGE_STATE`; the script creates a registration/workspace only for localhost/127.0.0.1. The equivalent Cypress diagram/agent save-reload scenarios live in `packages/server/cypress/e2e/3-diagrams/save-reload.cy.js`.

## Baseline repaired (October 4 follow-up)

Untouched main at `e6ab957` reproduced 29 LangGraph type errors and the missing schematic fixture / Yjs stub-provider convergence failures. Separate baseline PR [#15](https://github.com/internetmatt/IdeaFlow/pull/15) repaired these without dependency upgrades and merged into main at `f14e88c1bcbbf4ddefb6bf023f5ad44f179485e2`. Main was merged into this branch at `9b9aece5019190eb8547a4bab898000b9f82222a`; the baseline source changes remain outside this PR's diff against main.

Current validation of main plus the baseline fix:

-   Full server typecheck (`tsc --noEmit`) and build (`tsc`, email cleanup, `gulp`) pass.
-   Full diagram suite: 13 suites, 32 tests pass, including concurrent delayed Yjs edits and duplicate delivery.
-   Server text-content regressions: 2 tests pass. Dynamic LangGraph node/reducer/stream/checkpoint runtime smoke test passes.
-   Changed-file ESLint and `git diff --check` pass.

Current validation of this branch with repaired main:

-   Full server typecheck and build pass.
-   Full diagram suite: 14 suites, 34 tests pass.
-   Focused server reasoning, prediction, inference and signaling: 5 suites, 27 tests pass.
-   Existing UI suite: 3 suites, 70 tests pass; both asset tests pass.

The earlier production browser + SQLite save/reload evidence above remains valid; that live test was not repeated in this baseline follow-up. No live Projecto inference result is claimed. The Yjs repair assumes collaborators open the same persisted DSL; initial synchronization across different saved revisions remains separate work.
