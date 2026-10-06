# Make agent skills visually

Status: proposed authoring contract with a narrow offline graph-to-skill exporter. Publishing and an authorized pinned execution endpoint remain unimplemented. See [graph skill export](GRAPH-SKILL-EXPORT.md) for the supported Translator slice and its separate live acceptance gate.

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

A skill package carries agent-readable `SKILL.md` instructions and a versioned JSON manifest with the native graph binding, input/output schemas, capability requirements, fixture references and revision/digest metadata. The initial `pnpm skills:export --out <new-directory>` command supports the existing two-node Translator agentflow; other graph shapes and executors fail closed. Registration and publishing remain to be implemented. Do not put provider or operator secrets into any package, graph, browser configuration or artifact; resolve credential references on the trusted runtime.

The graph owns workflow logic. Skill instructions explain how to use it. The visual editor and a headless runner should operate on the same pinned graph rather than maintaining separate implementations.

## Execution boundary

Keep IdeaFlow's native flow semantics. Projecto orchestration graphs remain separate and can invoke IdeaFlow through an explicit host adapter. The Internet Matt canvas is a presentation option; its initial prototype supports picture flowcharts, not complete assistant agentflow editing or skill export.

See the [host platform contract](./HOST-PLATFORM-CONTRACT.md) and [headless harness session requirements](../.codex/skills/ideaflow-headless-run/references/session-contract.md). The headless skill instructions are present in the repo; their existence does not establish deployed token exchange, tenant execution, streaming, or publishing. Validate the actual runtime capabilities before using them.

## Next implementation slice

The initial offline binding/export path and regression fixtures are implemented for the existing Translator agentflow. Next, add an authorized adapter that executes the exported pinned graph, records a durable result, and proves that a draft edit during that actual run cannot change it. Keep that live gate open before marking visual skill publishing available.

## Proposed decisions and handoff

See the [ADR proposals](adr/README.md) and [catchup/implementation ownership](2026-10-04-catchup.md) for the headless/UI boundary and portable OpenIdea follow-up.
