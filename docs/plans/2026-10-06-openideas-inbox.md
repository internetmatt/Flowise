# Plan: OpenIdeas inbox format

Status: Plan, 2026-10-06. Builds on [ADR 003](../adr/003-portable-openidea-records.md), which is still Proposed. Nothing here is implemented yet.

## What OpenIdeas is

OpenIdeas is a portable format for an ideas inbox: a folder layout plus one record file per idea. It has two profiles that share the same records:

| Profile                | Who uses it                                                   | Storage                                           |
| ---------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| `openideas/drive`      | Individuals on personal accounts (the external, open version) | A Google Drive folder                             |
| `openideas/sharepoint` | Teams inside an organization (the internal version)           | A SharePoint document library used for publishing |

An idea written in either place moves from inbox to published the same way, and can be copied between the two without losing its identity or history.

OpenIdeas used to be the name of this repository. That moved to IdeaFlow on 2026-09-29. IdeaFlow is one consumer of OpenIdeas records, not their owner.

## Folder lifecycle

Both profiles use the same four stages. The folder an idea sits in and the `status` field in its record always agree.

```
inbox/                      raw captures, one file or folder each, no record yet
ideas/<id>/                 status: drafting
  openidea.json             the record
  brief.md                  what the idea is and who it is for
  copy/                     drafts and variants
publish/<yyyy-mm-dd>-<id>/  status: scheduled, then published
  openidea.json
  copy/FINAL-post.txt       final text, plus follow-up comments if any
  poster/                   final images
  motion/                   optional video or GIF
archive/<id>/               status: archived (published or dropped)
```

This layout is the one already used for a two-week social calendar (ideas drafted as copy variants, then a dated `publish/` folder per slot with final copy, poster and optional motion). The format writes down that working practice rather than inventing a new one.

Moving an idea to the next stage is a folder move plus a record update with a new revision. A tool that sees the two disagree reports a conflict; it does not guess.

## The record

`openidea.json` is an ADR 003 envelope. Fields, in the order a reader needs them:

| Field            | Meaning                                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| `schema`         | `openidea/v1`. Unknown versions are rejected.                                |
| `id`             | Stable ID, created once at capture and never reused.                         |
| `revision`       | Increments on every change. Used to detect concurrent edits.                 |
| `status`         | `captured`, `drafting`, `scheduled`, `published` or `archived`.              |
| `title`, `brief` | Short name and a path to `brief.md`.                                         |
| `sources`        | Links or file references the idea came from.                                 |
| `schedule`       | Optional slot: date, time, time zone, channel.                               |
| `artifacts`      | Relative paths to copy, images and motion, each with a content hash.         |
| `approvals`      | Who approved what and when. Evidence only; see rules.                        |
| `extensions`     | Additional fields from a specific tool, preserved as-is by every other tool. |

## Rules

These come from ADR 003 and apply to both profiles.

-   A link in a record is not an access grant. Each reader resolves references with its own permissions.
-   Concurrent edits are never silently overwritten. If two writers start from the same revision, the second one gets a conflict.
-   An approval recorded in one place grants nothing in another. A host that publishes must check its own approval rules.
-   Records never contain credentials, tokens or account bindings. Storage locations are resolved by the local profile, not stored in the record.
-   Unknown `extensions` fields survive a round trip.

## Phases

1. **Format and sample.** Write the JSON schema and one synthetic sample idea that goes through all four stages. Validate it with a small script. No network access.
2. **Drive adapter.** Read and write the layout in a Google Drive folder the user picks. Moves, revisions and conflict reporting are tested against a test folder.
3. **SharePoint adapter.** The same operations against a SharePoint document library, using the organization's own sign-in. Organization-specific settings live in local configuration, never in this repository.
4. **IdeaFlow round trip.** This is ADR 003's acceptance target: import one synthetic record, run one pinned skill on it through an authorized adapter, and export the updated status and artifact references.

Calendar dispatch and automatic publishing come after phase 4, and only once the earlier phases are proven.

## Where the code lives

For now the plan and, later, a small schema package (`packages/openideas`) live in this repository. When a dedicated `internetmatt/OpenIdeas` repository exists, the schema, sample and adapters move there and IdeaFlow depends on it. IdeaFlow keeps only its import and export adapter.

## Not decided yet

-   Whether `inbox/` items get a record at capture or only when promoted to `ideas/`.
-   How deletions are represented: an `archived` status only, or a separate tombstone.
-   Whether the SharePoint profile also maps to SharePoint list columns, or stays file-only.
-   Naming overlap: the `@openideas/diagram` package in this repository predates this plan and has nothing to do with the inbox format. Renaming it is an open question for the canvas work.
