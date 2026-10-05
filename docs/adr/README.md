# Proposed architecture decisions

These are proposals based on the IdeaFlow work, suitable for technical review and adaptation at ideus. They are not accepted ideus decisions and do not establish production runtime support. Use synthetic briefs and repo evidence when presenting them. Market research and measured implementation alternatives still need to be attached before adoption.

| Proposal | Decision | State |
| --- | --- | --- |
| [001](001-versioned-graph-skills.md) | Versioned skills implemented by native graphs | Proposed |
| [002](002-headless-runs-and-ui.md) | Separate durable execution from declarative presentation | Proposed |
| [003](003-portable-openidea-records.md) | Exchange OpenIdea records across workspaces and host adapters | Proposed |

Follow-ups to review separately: vendor-neutral host adapters, runtime authority with separate execute/observe/approve permissions, package extraction with bundle budgets, and shared design-token consumption. Existing [host contract](../HOST-PLATFORM-CONTRACT.md) and [UI adapter assessment](../UI-GRAPH-ADAPTER.md) supply starting evidence.
