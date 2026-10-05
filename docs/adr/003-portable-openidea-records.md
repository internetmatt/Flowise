# ADR 003: Exchange portable OpenIdea records

Status: Proposed

## Context

Research and ideas can become skill briefs, schedules, graph runs, decks, ads and architecture proposals. Projecto, IdeaFlow and a personal vault need to correlate that work without taking ownership of each other's native graphs or copying private account bindings into portable packages.

## Decision proposed

Use a versioned OpenIdea envelope containing a stable ID/revision, brief, source references, calendar references, skill/native-graph references, status, approval references and artifact references. Import/export adapters preserve the record identity and report conflicts. Keep native executable graphs in their own format. A referenced approval remains evidence; it grants no execution or approval authority in another host.

The local profile resolves logical storage/calendar resources to authorized vault paths, calendars or Google Drive folders. A shared calendar and Drive are configurable adapters. This proposal does not claim those routine integrations exist.

## Alternatives

- Copy documents without stable IDs: easy start, but duplicate work and conflicting statuses.
- One shared application database: simpler joins, but couples tenancy and domain ownership.
- Versioned work records and authorized references: requires adapter/conflict handling, while preserving boundaries.

## Consequences

Define the schema before shipping import/export. Preserve additive extension fields; reject unsupported versions explicitly. Resolve references under the recipient's permissions. Use recurrence-instance identity and an idempotency key when calendar occurrences dispatch runs. Do not silently overwrite concurrent revisions or treat imported links as access grants.

## Validation before acceptance

Import one synthetic OpenIdea, invoke one pinned skill through an available authorized adapter, then export status and artifact references. Round-trip stable ID, revisions, source references and approval history. Test replay without duplicate dispatch, unknown fields, conflicting edits and inaccessible Drive/vault references. Test real calendar/Drive operations only once configured adapters are available.

## Revisit when

The envelope cannot express collaboration/conflict semantics or reference retention prevents reproducible work.

Evidence: [visual skill contract](../VISUAL-AGENT-SKILLS.md), [host contract](../HOST-PLATFORM-CONTRACT.md). Calendar/vault/Drive and OfficeCLI integration are follow-up work, not demonstrated capabilities.
