# IdeaFlow documentation

This repository is transitioning from **OpenIdeas/Ideus** to **IdeaFlow**, the tenant-owned AI BizOps workspace provisioned by Projecto.

Start with the authoritative [IdeaFlow architecture and integration contract](./IDEAFLOW-ARCHITECTURE.md). It defines product boundaries, tenancy, Projecto identity and inference integration, Flowise chatflow/agentflow associations, Driver.js walkthroughs, and the dedicated Iggy-derived desktop contract.

Current transition references:

- Local development port: **3010**
- Existing packaging card: [`IDEUS-PACKAGING.md`](./IDEUS-PACKAGING.md)
- Existing core schema adapter: [`packages/server/src/ideus-core/`](../packages/server/src/ideus-core/README.md)
- Package manuals: `packages/agentflow`, `packages/ui`, and `packages/server`

Legacy OpenIdeas and Ideus names remain temporarily where changing them would break runtime consumers. New product-facing work should use **IdeaFlow**.
