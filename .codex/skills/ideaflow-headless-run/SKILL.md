---
name: ideaflow-headless-run
description: Execute IdeaFlow chatflows and assistant agentflows headlessly through a host-issued tenant session and stream HTML and artifacts to the bound browser harness. Use for InternetMatt IdeaFlow automation, scheduled idea sessions and authenticated flow execution.
---

# IdeaFlow headless run

Read docs/IDEAFLOW-ARCHITECTURE.md and docs/HOST-PLATFORM-CONTRACT.md in the
IdeaFlow checkout, then [the session contract](references/session-contract.md).

1. Discover the actual execution, identity exchange, artifact and stream adapters
   from server source and the configured host capabilities. Keep the core
   contract vendor neutral; resolve Projecto through its host adapter.
2. Resolve tenant_id, ideaflow_instance_id, actor membership, idea/conversation,
   attached chatflow or assistant agentflow, and a pinned flow revision.
   Verify these server-side; never treat a DIAGRAM record or signaling room as
   evidence of an executable AGENTFLOW.
3. Obtain a short-lived host-issued run grant with the intended audience,
   tenant, instance, execution and observation scopes. On Projecto, retain
   operator-token ancestry server-side without sending its bootstrap secret
   to IdeaFlow browser code. Never bypass membership with a global service key.
4. Create an idempotent execution through the registered engine adapter. Bind
   it to the host session/run/harness/browser IDs and persist its outcome.
   Keep provider credentials with the host inference capability.
5. Emit bounded progress, staged HTML revisions and durable artifact manifests
   through the registered harness transport. Sandbox previews; let the browser
   reconnect or attach later to the same run. Keep walkthrough metadata separate
   from executable flow definitions.
6. Preserve approval and audit boundaries. Hold publishing/external effects
   pending a valid decision for the exact artifact revision.
7. Verify tenant/session isolation, expiry/revocation, reconnect, cancel,
   malicious HTML isolation and artifact retrieval against a disposable tenant.
   Read package scripts to select supported tests; do not invent CLI commands.
8. Return redacted execution and artifact evidence plus explicit blocked gates.

Treat the architecture document as a foundation contract, not implementation
evidence. If token exchange, tenant authorization, authenticated streaming or
browser attach is absent, report it and prepare the adapter work separately.
Do not claim a headless execution succeeds from diagram save/reload tests.
