# Workflow management head start

Feature route: `/workflow-management`, protected by the existing agentflows:view permission. Use the Internet Matt variant branch for continued chat-loop integration.

Implemented: in-tab draft revision rail, scoped-memory/model preset editor, daily scheduled-session draft and a chat-loop brief composer that snapshots the selected binding. Export a management draft as JSON. No browser credential storage, no server mutations and no automatic activation.

The rail represents local draft checkpoints, not verified server revisions. Revision/model references are user-entered and must be resolved server-side before execution. Memory selections request access and do not grant it. Schedule exports are always disabled; local times/timezones and overlap choices are validated, with missed occurrences skipped. Refresh loses in-tab drafts; export before leaving.

Next: connect the real Internet Matt `/loop` chat components and authorized dispatch/events, durable revision/preset storage and the existing schedule service. Enforce tenant scope, immutable revision binding, approved memory access, occurrence idempotency and authorization for activation. The current schedule service lacks these complete management bindings; do not wire draft export directly to activation.

Validation: focused contract tests cover disabled scheduling, pinned references, invalid input and scope handling. No live scheduled dispatch or memory retrieval is claimed.
