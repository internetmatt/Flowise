# Headless harness session contract v1

Status: proposed integration requirements, not proof of deployed endpoints.
Discover actual adapters from the runtime manifest and source before invoking them.
Do not invent URLs, commands, transport support, or a token exchange.

## Identity and session binding

Keep the operator bootstrap credential on the trusted host. Exchange it through
the host identity adapter for a short-lived, audience- and scope-restricted run
credential. Use the authenticated principal, never client-supplied identity,
to authorize tenant, instance, flow, artifact, and harness access.

Bind a run to immutable identifiers:
`tenant_id`, `instance_id`, `operator_subject`, `session_id`, `run_id`,
`harness_id`, `browser_session_id`, `skill_id`, `skill_revision`,
`flow_id` and `flow_revision` where applicable.
Let the server allocate IDs and bind an existing browser through an
authenticated attach operation. IDs are correlation metadata, not credentials.
Authorize every attach, subscribe, upload, download, resume, and cancel.
Do not allow a caller to retarget an active run to a different tenant or browser.

Prefer an HttpOnly Secure SameSite browser session with CSRF protection for
mutations. A cross-origin handoff must use a one-time, short-lived exchange code,
an allowlisted exact origin and validated sender; never use the operator secret
in URLs, localStorage, generated HTML, postMessage, screenshots, traces or logs.
Revoke active grants, close streams and deny subsequent reads when the operator
or membership is revoked. Handle expiry by re-authenticating through the host;
do not keep reconnecting with an expired bearer.

## Execution and streaming

Make scheduling independent of an open browser. Persist run state, artifacts
and a bounded replay journal so the operator may attach later. Separate execute,
observe and approve permissions; execution authority never implies approval.

Use the runtime's registered stream transport (SSE, WebSocket or equivalent).
Every event must include schema_version, event_id, sequence, type, time, and
the authorized session/run/harness/browser binding. Supported semantic events:
run.started, run.progress, html.revision, artifact.created, approval.required,
run.completed, run.failed, run.cancelled. These are target semantics, not claims
that current adapters implement those exact names.

Allocate monotonically increasing sequence numbers per run, deduplicate event_id,
resume after the last acknowledged sequence and recover a gap using a snapshot
plus subsequent events. Retain a bounded journal and report expired cursors.
Bound connections, queue length, payload sizes and upload sizes. Apply
backpressure; disconnect slow consumers explicitly rather than growing queues.
Order artifact.created after durable upload and integrity validation.
A cancellation must stop workers and stream subscriptions; keep audit evidence.

Emit immutable artifact manifests containing artifact_id, revision, MIME type,
byte length, SHA-256 digest, producer skill revision and run/session provenance.
Authorize content retrieval separately; do not emit public or bearer-bearing
download URLs. Stage each HTML revision durably and publish an atomic revision
pointer. If chunking is supported, verify a complete revision and digest before
display; never render incomplete raw HTML directly into the operator document.

## Browser projection and approvals

Render generated HTML in a sandboxed preview on a separate origin or an opaque
iframe origin. With scripts enabled, omit allow-same-origin and privileged
navigation capabilities. Apply restrictive CSP, restrict network egress and
validate any postMessage bridge against source plus capability-bound message
types; opaque origin alone is not authentication. Never execute generated HTML
in the authenticated host DOM or give it session cookies or operator credentials.
Test that a malicious preview cannot read auth, navigate the host or call
privileged APIs. A trusted declarative widget adapter may be used only when
its capability policy has been verified.

Keep the browser a projection of the same run state used by Theater/Live and
Signal Router. Do not create a separate per-widget execution authority.
Publishing, deploying and external sends must consume an operator decision
bound server-side to action, artifact digest/revision, tenant, run, expiry and
one-use nonce. Validate the authenticated decision and reject replay or stale
revision. A UI button or DOM click is not authorization. Headless runs may
pause awaiting approval; never synthesize approval to keep a schedule moving.

## Acceptance evidence

Record commands, adapter versions, run IDs and redacted results for:
- Headless execution with no browser, followed by authorized browser attach.
- Two concurrent sessions receiving only their own HTML and artifacts.
- Cross-tenant, wrong-harness and wrong-browser attach/read/write rejection.
- Missing, expired and revoked credential rejection, including active streams.
- Reconnect with deduplication, gap recovery, bounded backpressure and cancel.
- Malicious HTML isolation and secret-free DOM, requests, logs and artifacts.
- Stale/replayed approval rejection and valid approval for the exact revision.
- Terminal outcome with artifact digest verification and Theater evidence.

Until these pass against the actual runtime, report workflow guidance installed
and runtime integration unverified or blocked. Do not report live readiness.
