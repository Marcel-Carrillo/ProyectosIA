---
name: "OPSX: Sync"
description: Sync delta specs from a change to main specs
category: Workflow
tags: [workflow, specs, experimental]
---

Sync delta specs from a change into the main specs (`openspec/specs/*`).

**Single source of truth.** The full, canonical logic for this operation lives in
`ai-specs/skills/openspec-sync-specs/SKILL.md`. That version is ecommerce-aware: it
reads `docs/base-standards.md` + `openspec/config.yaml`, applies intelligent partial
merges (ADDED / MODIFIED / REMOVED / RENAMED), and **validates that synced specs never
expose supplier cost or internal supplier data and never mix domain statuses**.

**Do this:** read and apply `ai-specs/skills/openspec-sync-specs/SKILL.md` in full,
using the change name from the command argument (or infer it from context / ask if it
is missing or ambiguous). Do not re-implement the steps here — `ai-specs/skills/openspec-sync-specs/SKILL.md`
is the only place this logic should live, so it stays correct in one place.

> Note: the CLI-generated `.claude/skills/openspec-sync-specs` / `.cursor/skills/openspec-sync-specs`
> mirrors are a thinner default and are NOT canonical. Always defer to the `ai-specs` version above.
