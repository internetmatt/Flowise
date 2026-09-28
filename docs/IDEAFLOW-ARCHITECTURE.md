# IdeaFlow architecture

Status: foundation contract  
Repository transition: `OpenIdeas` → `IdeaFlow`

## Product definition

IdeaFlow is a tenant-owned AI BizOps workspace. It is where an owner and invited teammates capture ideas, turn them into executable workflows, collaborate with AI assistants, review work, and audit outcomes.

An **idea** is a conversation session with an attached Flowise chatflow. Assistants may each have an associated Flowise agentflow. IdeaFlow can present guided, animated walkthroughs of either flow using Driver.js.

IdeaFlow is not the former Ideas/AIONUI application. No AIONUI runtime or session migration is required.

## System boundaries

| System | Owns | Does not own |
| --- | --- | --- |
| Projecto | Tenant provisioning, owner identity, workspace/site assignment, entitlements, inference access | IdeaFlow UI, flows, conversations, membership administration |
| IdeaFlow | Tenant workspace, AI BizOps, ideas/conversations, employees and teammates, invites, roles, chatflow and agentflow associations, approvals, audit history | Global identity, billing entitlements, model infrastructure |
| Flowise engine | Chatflow and agentflow definitions and execution primitives behind IdeaFlow | Product identity, tenancy policy, user-facing navigation |
| DeerFlow UI | IdeaFlow web experience, adapted to `@internetmatt/design-tokens` | Provisioning or inference infrastructure |
| Iggy desktop shell | Dedicated IdeaFlow desktop packaging, local launch, secure session handoff, deep links | Projecto Desktop or the former Ideas desktop |
| `@internetmatt/design-tokens` | Shared visual tokens used by the IdeaFlow experience | Runtime behavior |

Projecto and IdeaFlow integrate through explicit APIs and signed claims. They must not share application databases.

## Tenancy model

- One entitled owner account receives one Projecto-provisioned IdeaFlow instance.
- Each instance has an immutable `tenant_id` and `ideaflow_instance_id`.
- The owner can create AI BizOps and invite employees or teammates into that instance.
- An invited user is represented by a tenant-scoped membership and role.
- A person may be a member of multiple tenants. If separately entitled, that person may also own another IdeaFlow instance.
- Every persisted IdeaFlow object carries `tenant_id`; authorization is checked server-side on every request and execution.
- Tenant ownership transfer is an explicit administrative operation and must be audited.

Initial tenant roles:

| Role | Capabilities |
| --- | --- |
| Owner | Manage tenant, members, BizOps, flows, approvals, and audit access |
| Admin | Manage members and workspace configuration except ownership |
| Operator | Create and run ideas, chatflows, agentflows, and approvals |
| Member | Participate in assigned ideas and conversations |
| Viewer | Read-only access to permitted workspace content |

## Projecto provisioning contract

Projecto provisions an instance using a server-to-server request. Configuration contains identifiers and service locations, never long-lived user or provider secrets.

```json
{
  "contract_version": "2026-09-01",
  "tenant_id": "ten_...",
  "ideaflow_instance_id": "ifi_...",
  "owner_subject": "usr_...",
  "site_origin": "https://workspace.example",
  "inference_base_url": "https://inference.example/v1",
  "model_catalog_url": "https://inference.example/v1/models",
  "token_exchange_url": "https://identity.example/oauth/token",
  "desktop_callback_scheme": "ideaflow",
  "provisioned_at": "2026-09-28T00:00:00Z"
}
```

Required behavior:

1. Projecto creates or reconciles the tenant and instance idempotently.
2. IdeaFlow binds the owner membership to `owner_subject`.
3. Projecto issues short-lived, audience-restricted credentials or exposes a token exchange endpoint.
4. IdeaFlow reports readiness and its canonical `site_origin`.
5. Both systems log the provisioning correlation ID.

The contract should be versioned before fields become production dependencies. Unknown additive fields are ignored; breaking changes require a new contract version.

## Identity and inference boundary

IdeaFlow accepts Projecto-issued identity tokens with at least:

```json
{
  "sub": "usr_...",
  "aud": "ideaflow",
  "tenant_id": "ten_...",
  "ideaflow_instance_id": "ifi_...",
  "roles": ["operator"],
  "exp": 1790557200
}
```

IdeaFlow validates issuer, audience, signature, expiry, instance, tenant, and server-side membership. Browser claims alone never grant access.

Inference goes through the Projecto gateway using short-lived tenant-scoped credentials. The gateway enforces entitlement, model policy, rate limits, and usage attribution. IdeaFlow stores model references and execution metadata, but not provider credentials. An OpenAI-compatible surface is preferred where it does not hide required tenant or audit semantics.

## Idea and flow model

The initial associations are:

- `Idea` → one primary conversation session.
- `Idea` → zero or one attached Flowise chatflow.
- `Assistant` → zero or one attached Flowise agentflow.
- `BizOp` → many ideas, assistants, members, approvals, and audit events.
- Flow references store stable external IDs plus a revision/version marker; IdeaFlow does not rely on mutable display names.
- Execution records capture tenant, actor, idea, flow ID, flow revision, model, timestamps, approval state, and outcome.

Guided walkthroughs are product metadata, separate from executable flow definitions. Each walkthrough targets stable node or control identifiers and contains ordered Driver.js steps. A missing target skips safely and emits telemetry rather than blocking the workspace.

## Dedicated desktop contract

The IdeaFlow desktop application is based on the Iggy build and remains independent of Projecto Desktop.

Minimum boot inputs:

```json
{
  "site_origin": "https://workspace.example",
  "tenant_id": "ten_...",
  "ideaflow_instance_id": "ifi_...",
  "token_exchange_url": "https://identity.example/oauth/token",
  "callback_uri": "ideaflow://auth/callback"
}
```

Desktop requirements:

- Use the system browser for authentication and return through the `ideaflow://` deep link.
- Store refresh material only in the operating system credential store.
- Restrict navigation and IPC to allowlisted origins and messages.
- Never package provider keys or Projecto service credentials.
- Support macOS first through the Iggy-derived build; add Windows packaging from the same application contract.
- Load the tenant's Projecto-assigned `site_origin`, not a hard-coded environment.

## Compatibility during transition

- The GitHub repository may remain named `OpenIdeas` until the settings-level rename to `IdeaFlow` is performed.
- Existing `OPENIDEAS_*`, `IDEUS_*`, and Flowise-compatible environment names may remain as deprecated aliases during a measured transition.
- New product-facing code and documentation should use **IdeaFlow**.
- Port `3010` remains the local development default until runtime configuration is consolidated.
- The former `internetmatt/Ideas` repository is not an IdeaFlow dependency. Reusable contracts may be extracted before that repository is archived.

## Delivery sequence

1. Establish this contract and the IdeaFlow product identity.
2. Introduce versioned Projecto provisioning, token exchange, and readiness endpoints.
3. Adapt the DeerFlow UI to the design-token package and bind tenant navigation.
4. Add Idea, chatflow, assistant, agentflow, membership, approval, and audit schemas.
5. Add Driver.js walkthrough metadata and execution views.
6. Build the dedicated Iggy-derived desktop shell against the boot contract.
7. Add staging tenant provisioning and end-to-end tests on macOS and Windows.
8. Remove deprecated OpenIdeas/Ideus names only after consumers have migrated.

## Architectural acceptance criteria

The foundation is ready for implementation when:

- A Projecto test owner can idempotently provision exactly one IdeaFlow instance.
- The owner can invite a teammate whose access is enforced by tenant-scoped server checks.
- An idea can attach and run a versioned chatflow; an assistant can attach and run a versioned agentflow.
- Executions use Projecto inference without exposing provider credentials.
- A Driver.js walkthrough can animate a flow without mutating it.
- The Iggy-derived desktop shell authenticates, resolves the assigned site, and opens the same tenant workspace as the web app.
- Cross-tenant reads, writes, executions, and desktop handoffs are covered by negative tests.
