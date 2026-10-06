# Plan: remove Flowise's commercial enterprise code

Status: Plan, 2026-10-06. Not started.

## Finding

IdeaFlow still ships FlowiseAI's commercially licensed code on `main` (checked at `0cee682`, 2026-10-05):

-   `packages/server/src/enterprise/`: 157 paths, about 32,400 lines, under its own `LICENSE.md` ("The FlowiseAI Inc Commercial License"). Production use requires a FlowiseAI subscription.
-   `packages/server/src/IdentityManager.ts`: the root `LICENSE.md` names it as commercial too, because it carries an explicit copyright notice.

Everything else is Apache-2.0. IdeaFlow does not relicense the commercial tree, so until these files are gone the repository is not cleanly open source.

## Why deleting the folder is not enough

64 server files outside `enterprise/` import from it:

| Import                                                               | Importers | Used for                                                          |
| -------------------------------------------------------------------- | --------- | ----------------------------------------------------------------- |
| `rbac/PermissionCheck`                                               | 29        | Permission middleware on most routes                              |
| `utils/ControllerServiceUtils`                                       | 12        | Workspace-scoped queries                                          |
| `workspace`, `organization`, `role`, `user`, `login-method` entities | 28        | Every chatflow, credential and API key row belongs to a workspace |
| `Interface.Enterprise`                                               | 4         | Shared types                                                      |
| SSO providers (Google, GitHub, Azure, Auth0)                         | 8         | Login                                                             |
| Workspace and organization services                                  | 6         | Lookups                                                           |

51 database migrations live inside `enterprise/`, and 8 core migrations import from it. The tables they create are used even in open-source mode, which runs with one default organization and workspace. About 14 Apache-2.0 UI files in `packages/ui` show enterprise screens (users, roles, workspaces, SSO, audit) that would become dead code.

## Approach

IdeaFlow runs inside a host platform that already owns sign-in, roles and tenancy (see the [host platform contract](../HOST-PLATFORM-CONTRACT.md), `identity` capability). IdeaFlow does not need its own users, organizations, roles or SSO. It needs to trust the host.

1. Add an Apache-2.0 `host-identity` module that answers the questions the server asks today: who is calling, which workspace they are in, and whether an action is allowed. Standalone and development mode return one fixed user and workspace with every permission. Hosted mode reads the identity the host provides.
2. Point the 64 importers at the new module, keeping the function names they call (`checkPermission`, `checkAnyPermission`, `getWorkspaceSearchOptions`), so most edits are import swaps.
3. Keep the columns the core entities need (for example `workspaceId`) and write a fresh migration set from IdeaFlow's own schema.
4. Delete `packages/server/src/enterprise/`, the commercial `IdentityManager.ts`, the SSO routes and the enterprise UI screens. Update the root `LICENSE.md` to Apache-2.0 only.
5. Add a CI check that fails if a path named `enterprise/` or the commercial license text comes back, since every upstream merge would otherwise reintroduce it.

Clean-room rule: write the replacement from the import signatures and IdeaFlow's own needs, never by copying the commercial files.

## Open questions

-   **History:** removing the files from `main` leaves them in git history and in the upstream branches mirrored into this fork. Whether that matters is a licensing question, not an engineering one.
-   **Upstream merges:** every merge from FlowiseAI/Flowise touches these importers. Keep merging, or switch to cherry-picks?
-   **Size:** the import swaps are mechanical; the migrations and the workspace model need design. Size it after a spike.

## First step

A spike branch: stub `PermissionCheck` and `ControllerServiceUtils` with the host-identity module, delete `enterprise/`, and count what still fails to build and test. That gives a real size before any dates.
