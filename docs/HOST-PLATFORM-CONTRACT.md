# IdeaFlow host platform contract

Status: initial compatibility contract

IdeaFlow is host-neutral. It consumes capabilities from a host platform; it does not require Projecto as a product dependency.

Projecto is the current first-party host implementation. Other hosts may satisfy the same contract without changing IdeaFlow's product model.

## Capability families

A host may advertise any subset of these capability families:

- `identity` — subject, tenant/workspace claims, roles, token exchange.
- `inference` — model catalog and OpenAI-compatible or declared inference endpoints.
- `commands` — named actions with input/output schemas and approval policy.
- `events` — subscribable event types and transport metadata.
- `assets` — import/export/open/save resource operations.
- `workspace` — instance/site assignment, readiness, deep links and lifecycle.
- `surface` — optional embed/open metadata for a host-provided UI surface.
- `graph` — optional node/edge document exchange; this does not make host graphs IdeaFlow flows.

Capabilities are additive. IdeaFlow must not infer a capability from a host product name.

## Server configuration

Canonical IdeaFlow-owned environment names:

- `IDEAFLOW_HOST_INFERENCE_BASE`
- `IDEAFLOW_HOST_INFERENCE_TOKEN`

During migration the server accepts `PROJECTO_INFERENCE_BASE` and `PROJECTO_OPERATOR_API_KEY` as deprecated aliases. They are implementation compatibility only and must never be serialized to browser configuration.

## Provisioning envelope

A host provisions or reconciles IdeaFlow with a versioned envelope:

```json
{
  "contract_version": "host-platform/v1",
  "host": {
    "instance_id": "host_...",
    "implementation": "projecto"
  },
  "tenant_id": "ten_...",
  "ideaflow_instance_id": "ifi_...",
  "owner_subject": "usr_...",
  "site_origin": "https://workspace.example",
  "capabilities": {
    "identity": { "token_exchange_url": "https://identity.example/oauth/token" },
    "inference": {
      "base_url": "https://inference.example/v1",
      "model_catalog_url": "https://inference.example/v1/models"
    }
  },
  "desktop_callback_scheme": "ideaflow",
  "provisioned_at": "2026-10-05T00:00:00Z"
}
```

`host.implementation` is diagnostic metadata, not a behavior switch. IdeaFlow selects behavior from declared capabilities.

## Boundary rules

- IdeaFlow flows remain IdeaFlow-owned chatflow/agentflow/diagram records.
- Host graphs or workflows remain host-owned unless explicitly imported.
- Projecto Flows are therefore not IdeaFlow flows.
- Projecto `/loop` is not part of the IdeaFlow host contract.
- Provider credentials stay behind the host/server boundary.
- Browser code receives scoped IdeaFlow APIs, never host service credentials.
- Host-specific compatibility aliases belong in adapter modules, not product/domain code.
