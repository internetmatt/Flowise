# ADR 001: Versioned skills implemented by native graphs

Status: Proposed

## Context

Visual workflows and agent-readable instructions can drift when they encode the same behavior separately. IdeaFlow already stores native executable flow definitions, while the visual skill export and publishing path remains to be implemented.

## Decision proposed

A skill version binds usage instructions, input/output schemas, capability requirements, fixture references and an integrity-checked native graph revision. Visual authoring and headless invocation use that same revision. Keep chatflow and agentflow semantics intact; picture diagrams require a validated executable implementation. A skill manifest is a usage and binding contract, not a second workflow engine.

## Alternatives

- Maintain prompt-only skills and separate workflow definitions: fewer packaging requirements, but behavior can drift.
- Translate every graph into one universal format: easier interchange, but risks loss of handles, executor semantics and metadata.
- Bind skills to native graphs: explicit adapter and versioning work, with preserved semantics.

## Consequences

Graph export must preserve component payloads, port/edge handles and credential references. Unknown executors or capabilities must fail validation. Breaking schema changes need migration/versioning. Resolve credentials on the authorized runtime; portable packages contain references rather than secrets.

## Validation before acceptance

Export one agentflow, execute its pinned revision through an actual authorized adapter and record a durable result. Demonstrate that editing the draft graph does not change an active run. Cover missing executors, payload preservation and input/output validation. Persistence/signaling tests alone are insufficient.

## Revisit when

Executor portability requirements change, graph migrations cannot preserve semantics, or package versioning becomes incompatible with actual deployment needs.

Evidence: [visual skill contract](../VISUAL-AGENT-SKILLS.md), [native flow types](../../packages/agentflow/src/core/types/flow.ts).
