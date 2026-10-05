# Make agent skills visually

Status: product direction and proposed authoring contract. This document does not implement a skill exporter, publisher, or execution endpoint.

IdeaFlow's graph is the visual implementation of an agent skill. Users connect models, agents, tools, conditions, approvals, and subflows, then describe when to use that capability and what it accepts and produces.

| Object | Role |
| --- | --- |
| Skill | Reusable named capability, instructions, input/output contract and required permissions |
| Chatflow | Graph implementation for a conversational capability |
| Assistant | Configured collaborator that may use multiple skills and have an associated agentflow |
| Agentflow | Graph implementation coordinating agents, tools, models and control flow |
| Picture diagram | Explanation or storyboard; becomes executable only through an explicit validated implementation |
| Host runtime | Authorizes and dispatches a pinned skill/graph run, preserves approvals, and exposes authorized progress/artifacts |

## Authoring and packaging direction

1. Define a skill name, description, usage instructions, inputs, outputs and required capabilities.
2. Build its implementation with the existing IdeaFlow graph and native node payloads. A UI renderer change must not change execution semantics.
3. Validate the graph and test fixtures for success, failure, cancellation and approval pauses. Preserve results and artifact provenance.
4. Pin the graph revision, dependencies and declared permissions. Package skill instructions alongside a graph reference or exported native graph and its integrity digest.
5. Publish a versioned package or register a versioned capability only after the relevant packaging and runtime adapters exist.
6. Invoke it through an authorized tenant session, headlessly or from a browser. A browser is an optional view of the run.

A skill package should carry agent-readable `SKILL.md` instructions and machine-readable graph binding, input/output schemas, capability requirements, fixture references and revision/digest metadata. Exact serialization and package/export commands remain to be implemented. Do not put provider or operator secrets into any package, graph, browser configuration or artifact; resolve credential references on the trusted runtime.

The graph owns workflow logic. Skill instructions explain how to use it. The visual editor and a headless runner should operate on the same pinned graph rather than maintaining separate implementations.

## Execution boundary

Keep IdeaFlow's native flow semantics. Projecto orchestration graphs remain separate and can invoke IdeaFlow through an explicit host adapter. The Internet Matt canvas is a presentation option; its initial prototype supports picture flowcharts, not complete assistant agentflow editing or skill export.

See the [host platform contract](./HOST-PLATFORM-CONTRACT.md) and [headless harness session requirements](../.codex/skills/ideaflow-headless-run/references/session-contract.md). The headless skill instructions are present in the repo; their existence does not establish deployed token exchange, tenant execution, streaming, or publishing. Validate the actual runtime capabilities before using them.

## Next implementation slice

Add a graph-to-skill binding and export path for one existing agentflow, with a pinned revision and declared input/output schemas. Test preservation of node payloads, edge handles and credential references; reject missing executors or undeclared capabilities. Then demonstrate an authorized end-to-end run of that exported skill with a durable result before marking visual skill publishing available.
