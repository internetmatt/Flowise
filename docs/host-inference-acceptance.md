# Real host inference acceptance

`pnpm acceptance:host-inference` runs a production IdeaFlow server and Chromium
against the configured real OpenAI-compatible host gateway. It never mocks,
intercepts, or substitutes the upstream. A successful report means this gateway
worked at that time; it is Projecto acceptance only when that gateway is Projecto.
No live gateway acceptance is claimed by adding this harness.

## Prepare and run

From the repository root with Node 24, pnpm 10.26 and installed Chromium:

```sh
pnpm install --frozen-lockfile
pnpm build
# Bind these in the shell through your normal secret manager; do not put a bearer in a command line.
export IDEAFLOW_HOST_INFERENCE_BASE='http://127.0.0.1:4716/v1'
# IDEAFLOW_HOST_INFERENCE_TOKEN must already contain the gateway bearer.
export IDEAFLOW_BROWSER_PATH='/path/to/chromium'
pnpm acceptance:host-inference
```

The `/v1` value above is an example, not discovery or proof of a running gateway.
Use the reachable gateway's actual API base, including its version path.
The token must allow model listing and non-streaming chat completions.
One generation may consume inference capacity. Choose an advertised flowchart-capable
model with `IDEAFLOW_ACCEPTANCE_MODEL`; otherwise the first advertised ID is used.
`IDEAFLOW_BROWSER_PATH` is optional when Playwright's Chromium is installed.
`IDEAFLOW_PLAYWRIGHT_MODULE` can point to an installed Playwright module; by default
it uses the repository's existing components dependency.
`IDEAFLOW_ACCEPTANCE_REPORT` sets the JSON output path (default:
`artifacts/host-inference-acceptance.json`). Keep output outside source control.

Only the server receives `IDEAFLOW_HOST_INFERENCE_TOKEN` and
`IDEAFLOW_HOST_INFERENCE_BASE`. The harness deliberately does not use the legacy
`PROJECTO_OPERATOR_API_KEY` or `PROJECTO_INFERENCE_BASE` aliases. Both token variables
are absent in the missing-token server. Production entry points are invoked directly
rather than through the CLI, whose BaseCommand loads `.env` with overrides.
Each server receives an allowlisted environment, a separate temporary SQLite database,
secret/log/blob directory, loopback binding and an ephemeral port. No existing server,
workspace, storage state or database is used. Database and UI builds must exist first.

## Checks and evidence

1. Start a server with neither host token nor legacy token; create a unique disposable
   OSS account/workspace via registration, log in normally, and require session cookies.
2. Open `/diagram` to create a workspace-owned diagram. Its actual studio model request
   must return sanitized HTTP 502. Send a valid completion request from that browser
   session through the same room proxy; it must also return sanitized 502.
3. Start a separate server with the configured real gateway and repeat registration,
   login and diagram creation. Require the studio's model listing to return 200 and
   at least one model; select an advertised model and click the studio Generate button.
4. Require its `/api/v1/diagram-inference/:roomId/chat/completions` response to return
   200, the UI to finish generation without an error, Mermaid `flowchart TD` or `LR`
   with an edge, and at least two rendered nodes. Neither browser inference request
   may contain an Authorization bearer.
5. Delete each diagram, close browser sessions, terminate servers and remove the
   temporary databases, workspace/account data and server logs, including on failure.

Exit 0 and `status: "pass"`, `liveGatewayAccepted: true` mean all checks including
cleanup passed. Exit 1 and `status: "fail"` mean acceptance failed; `checks` names the
stage. Missing configuration fails before startup and never counts as the runtime
missing-token check. The runtime missing-token case is controlled by the harness's
server environment rather than inferred from an unreachable upstream.

The JSON contains timestamps, fixed check names/statuses, HTTP status, model count
and a SHA-256 of the generated DSL. It excludes bearer, session cookies, host URLs,
raw model IDs, prompts, completions, response bodies and exception messages. Server
stdout/stderr is suppressed; temporary logs are removed. Do not add browser traces,
storage-state dumps or debug logging to a shared acceptance artifact. A DSL digest
supports comparison without publishing content; it is not proof of model/node identity.
Save gateway-side evidence separately if acceptance also requires a specific backend
model or worker. This test covers inference transport and rendering; the existing
`validate-diagram-live.mjs` remains the persistence/signaling regression harness.
