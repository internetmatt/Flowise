# Native graph skill export

The first offline slice binds the existing `packages/server/marketplaces/agentflowsv2/Translator.json` to `translate-english-to-japanese` version `0.1.0`. It preserves the complete native JSON graph. No UI save handler, inference route or workflow engine is changed.

## Export and verify

Run from an installed checkout using the repository's Node 24 and pnpm 10 versions:

```sh
pnpm test:graph-skills
pnpm skills:export --out /absolute/path/to/new-translator-package
```

The output directory must not already exist, and its parent must exist. The command validates everything before creating it and refuses to overwrite an existing version. Optional `--graph <tracked-repo-path>` and `--binding <binding-json-path>` select a compatible native graph and usage contract. Graph and executor source bytes must match `HEAD`; commit graph edits before exporting. The supplied binding may be a draft, but its instructions, schemas, fixtures and metadata become part of the resulting package.

| File | Binding |
| --- | --- |
| `manifest.json` | Schema version 1, semantic skill version, graph identity/source revision, input/output schemas, capabilities, executor source digests, credential-reference inventory and acceptance status |
| `graph.json` | Complete native graph, including node payloads, edge handles, order, viewport and metadata |
| `SKILL.md` | Agent-readable usage instructions with graph revision and manifest links |
| `fixtures.json` | Input/output contract examples, integrity checked and validated against the schemas; no inference result is claimed |

The machine-readable contract is `scripts/graph-skills/contract.schema.json`. The initial usage binding is `scripts/graph-skills/translator.binding.json`. Inputs require `{ "question": "English text" }`; outputs are final nonempty text extracted by a future native runtime adapter. The generic IdeaFlow prediction response envelope is not the skill output contract.

Graph revision is `sha256:<hex>` over canonical native JSON: sort object keys recursively, retain array order and all values, and encode compact UTF-8 JSON. Whitespace and key insertion order do not affect the digest. Arrays, handles, native payload fields and credential references do. Non-JSON values are rejected rather than dropped. This is an integrity check, not a signature or publisher authentication mechanism.

## Supported executors and permissions

The trusted export policy in `scripts/graph-skills/executors.mjs` checks the repository sources for Start's `run`, LLM's `run` and Google Generative AI's `init` entrypoints, then pins those files by SHA-256. The native payload versions are Start 1.1 and LLM 1.0, as stored in the existing Translator. These source checks do not prove that a deployed host has loaded or enabled those executors.

Only the existing two-node chat-input Start → LLM shape with its native handles and nested `chatGoogleGenerativeAI` model is supported. Unknown/missing executors, new payload versions, tool/subflow/approval nodes, memory, persistent state, caching, image uploads, custom endpoints and unsupported input/config fields are rejected. Extend the trusted policy alongside validation and fixtures before supporting another feature. Node metadata never authorizes a capability.

The model policy requires `model.generate`, `network.egress` and `credential.resolve`. Unknown or missing declarations fail export. Invocation preparation separately checks a capability grant supplied by the trusted caller; the package cannot grant itself authority. An actual host must derive that grant from the authorized tenant session and enforce it during execution.

Native `credential`, `credentialId` and nested `FLOWISE_CREDENTIAL_ID` references remain unchanged and are inventoried by JSON pointer. The existing marketplace graph has no bound provider credential; the trusted host must resolve its credential or environment configuration before execution. Export rejects populated known secret fields, malformed credential references and recognizable inline provider tokens. This is not a general secret detector: review portable graph/binding contents and never insert secrets in arbitrary text or metadata. No credential is retrieved or serialized by the exporter.

## Invocation snapshot boundary

`scripts/graph-skills/package.mjs` exposes:

- `bindGraphSkill`: validate a native graph/usage contract and produce a frozen package.
- `verifyGraphSkill`: validate a reloaded package, schemas, fixture contracts, graph/instruction/fixture digests, credential inventory and trusted executor pins.
- `pinSkillInvocation`: verify the package, check caller-granted capabilities and input, then return a deeply frozen independent graph/input snapshot with a package digest.
- `validateSkillOutput`: validate final text against the pinned output schema without coercion.

The regression mutates the original graph, binding, reloaded bundle and caller input after preparation and verifies that the invocation bytes and revision stay unchanged. A later export gets a different revision. This proves in-process snapshot isolation, not isolation of an actual active native run. A future adapter must persist and dispatch this snapshot, preserve its package digest and graph revision across restarts/approval resumes, and never reload a mutable graph by ID while executing it.

## Acceptance gates

Offline checks cover the real marketplace graph export/reload, payload/handle/credential-reference preservation, input/output validation, strict invalid schemas, tampering, unknown/unavailable executors and undeclared/unauthorized capabilities. `pnpm test:graph-skills` is also part of Node CI. Ajv 8.20.0 is declared directly for these repository tools; the existing lockfile already contains that version and its dependency closure.

Every exported manifest records `acceptance.liveRun: "pending"`. No reachable authorized tenant runtime was supplied for this slice, and no headless run or publishing result is claimed. ADR 001 remains Proposed. Before accepting it:

1. Supply an authorized tenant session and an actual native adapter with matching enabled executor implementations and provider credential resolution.
2. Verify and persist the exported package/invocation, enforce its capability grant, then run its pinned graph with valid input.
3. Edit/save the authoring draft while that run is active. Record the draft's new revision and prove the active run keeps the old package digest, graph revision and payload. Repeat across a resume/restart if supported.
4. Record the durable native result, validate extracted output, and preserve run/session/graph/artifact provenance. Verify invalid inputs, missing executors and unauthorized capabilities fail before dispatch.
5. Add cancellation/failure/approval-pause fixtures when their adapters and node policies are implemented. Complete publisher/registration work before advertising visual skill publishing.
