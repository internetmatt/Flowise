# ADR 002: Separate durable execution from declarative presentation

Status: Proposed

## Context

Agents need to perform work without an open browser. People need progress, previews, approvals and results through the Internet Matt UI. Reimplementing workflow logic in each UI creates competing execution state.

## Decision proposed

The runtime owns an authorized, revision-pinned run and its durable artifacts. A declarative UI binds to that run's authorized events and artifacts. Closing the UI does not cancel work; cancellation is an explicit command. Approval authority remains separate from execution and observation. UI declarations specify supported views and controls, with commands authorized server-side.

## Alternatives

- Browser-owned execution: simple interactive prototype, but depends on browser lifetime.
- Separate headless and interactive implementations: independent deployment, but duplicated logic and divergent results.
- One durable run with optional views: needs replay/session infrastructure, but supports both modes consistently.

## Consequences

Requires authenticated attach/resume, bounded event journals, ordered artifact publication, cancellation propagation and expiry/revocation handling. Generated HTML must use the documented sandbox boundary. The existing flowchart renderer experiment does not implement these runtime facilities.

## Validation before acceptance

Start one run without a browser, attach the UI later, disconnect/reconnect and recover consistent state. Test duplicate events, expired cursors, cancellation, revoked access and approval pauses. A second unauthorized tenant must be denied. Display the same result in headless output and UI.

## Revisit when

Transport replay limits, offline behavior or required rendering capabilities cannot satisfy the interaction model.

Evidence: [headless session contract](../../.codex/skills/ideaflow-headless-run/references/session-contract.md), [UI adapter assessment](../UI-GRAPH-ADAPTER.md).
