---

name: openspec-sync-specs
description: Sync delta specs from an active OpenSpec change into main specs without archiving the change. Use when the user wants to update main specs with accepted changes from a delta spec.
license: MIT
compatibility: Requires OpenSpec CLI.
metadata:
author: openspec
version: "1.0"
generatedBy: "1.3.1"
--------------------

# openspec-sync-specs Skill

Sync delta specs from an active OpenSpec change into the main OpenSpec specs.

This is an **agent-driven** operation. The agent reads delta specs and directly edits main specs to apply the changes intelligently.

This skill is useful when a change has been accepted conceptually and the main specs must be updated, but the change should remain active and must not be archived yet.

## Project Context

This project is a women's fashion ecommerce platform using supplier-fulfilled ecommerce.

Important domain rules:

* Customer orders and supplier orders are different concepts.
* A customer order may generate one or more supplier orders.
* Product variants are the sellable units of the catalog.
* Supplier costs, supplier credentials, supplier notes, supplier references, and internal fulfillment notes must not be exposed through customer-facing APIs.
* Customer-facing order status and internal fulfillment status must be modeled separately.
* Payment status, order status, fulfillment status, supplier order status, shipment status, return status, and refund status must not be mixed.
* The first version prioritizes manual supplier order processing over premature automation.

## Input

Optionally specify a change name.

If omitted, infer it from the conversation context only when it is unambiguous.

If the change name is missing, vague, or ambiguous, list available changes and ask the user to choose.

Do not guess or auto-select a change.

## Selective Context Loading

Use selective context loading to reduce token usage.

Always read:

* `docs/base-standards.md`
* `openspec/config.yaml`

Read additional documentation only when relevant:

* For backend-related specs:

  * `docs/backend-standards.md`
  * `docs/data-model.md`
  * `docs/api-spec.yml`
* For frontend-related specs:

  * `docs/frontend-standards.md`
  * `docs/api-spec.yml`
* For documentation-only changes:

  * `docs/documentation-standards.md`
* For ecommerce domain changes:

  * `docs/data-model.md`
  * `docs/api-spec.yml`

Do not read frontend standards for backend-only spec synchronization unless frontend impact must be analyzed.

Do not read backend standards for frontend-only spec synchronization unless backend or API impact must be analyzed.

## Steps

### 1. Determine the change name

If no change name is provided:

1. Run:

```bash
openspec list --json
```

2. Show available active changes that contain delta specs under:

```text
openspec/changes/<change-name>/specs/
```

3. Ask the user to select the change.

Do not guess or auto-select.

If no available changes contain delta specs, inform the user and stop.

### 2. Find delta specs

Look for delta spec files in:

```text
openspec/changes/<change-name>/specs/*/spec.md
```

Each delta spec file may contain sections such as:

* `## ADDED Requirements`
* `## MODIFIED Requirements`
* `## REMOVED Requirements`
* `## RENAMED Requirements`

If no delta specs are found, inform the user and stop.

### 3. Read each delta spec and matching main spec

For each capability with a delta spec at:

```text
openspec/changes/<change-name>/specs/<capability>/spec.md
```

Read:

```text
openspec/changes/<change-name>/specs/<capability>/spec.md
```

Then read the matching main spec if it exists:

```text
openspec/specs/<capability>/spec.md
```

If the main spec does not exist yet, prepare to create it.

### 4. Apply changes intelligently

Apply delta changes to the main spec.

#### ADDED Requirements

* If the requirement does not exist in the main spec, add it.
* If the requirement already exists, update it to match the delta and treat it as an implicit modification.
* Preserve existing content that is not contradicted by the delta.

#### MODIFIED Requirements

* Find the requirement in the main spec.
* Apply only the changes described in the delta.
* Add new scenarios when provided.
* Modify existing scenarios when explicitly changed.
* Update the requirement description when explicitly changed.
* Preserve scenarios and content not mentioned in the delta.

#### REMOVED Requirements

* Remove the entire requirement block from the main spec.
* If the requirement does not exist, report it in the summary.

#### RENAMED Requirements

* Find the `FROM` requirement.
* Rename it to the `TO` requirement.
* Preserve its scenarios and content unless the delta also modifies them.

### 5. Create new main specs when needed

If the main spec does not exist:

1. Create:

```text
openspec/specs/<capability>/spec.md
```

2. Add a brief `## Purpose` section.
3. Add a `## Requirements` section.
4. Apply the added requirements from the delta spec.

Mark uncertain purpose text as `TBD` only when there is not enough context.

### 6. Validate ecommerce consistency

When the synchronized spec affects ecommerce domain behavior, verify that it does not violate these rules:

* Do not mix `CustomerOrder` and `SupplierOrder`.
* Do not expose supplier cost or internal supplier data to customer-facing behavior.
* Do not mix order, payment, fulfillment, supplier order, shipment, return, or refund statuses.
* Do not treat `Product` as the sellable unit when the behavior should apply to `ProductVariant`.
* Do not introduce internal stock assumptions unless explicitly requested.

If a potential inconsistency is found, stop and ask for clarification before editing the main spec.

### 7. Summarize the result

After applying all changes, summarize:

* Which capabilities were updated.
* Which main spec files were created or edited.
* Which requirements were added, modified, removed, or renamed.
* Any warnings or unresolved questions.
* Whether `docs/data-model.md` or `docs/api-spec.yml` may also need an update.

## Delta Spec Format Reference

```markdown
## ADDED Requirements

### Requirement: New Feature
The system SHALL do something new.

#### Scenario: Basic case
- **WHEN** user does X
- **THEN** system does Y

## MODIFIED Requirements

### Requirement: Existing Feature
#### Scenario: New scenario to add
- **WHEN** user does A
- **THEN** system does B

## REMOVED Requirements

### Requirement: Deprecated Feature

## RENAMED Requirements

- FROM: `### Requirement: Old Name`
- TO: `### Requirement: New Name`
```

## Key Principle: Intelligent Merging

Unlike programmatic merging, this skill applies **partial updates**.

* To add a scenario, include only that scenario under `MODIFIED Requirements`.
* The delta represents intent, not a wholesale replacement.
* Preserve unrelated existing requirements and scenarios.
* Use judgment to merge changes sensibly.
* Keep the operation idempotent: running it twice should produce the same result.

## Output On Success

```markdown
## Specs Synced: <change-name>

Updated main specs:

**<capability-1>**
- Added requirement: "New Feature"
- Modified requirement: "Existing Feature" by adding 1 scenario

**<capability-2>**
- Created new spec file
- Added requirement: "Another Feature"

Warnings:
- <Any warnings, or "None">

Documentation impact:
- docs/data-model.md: <Required | Not required | Review recommended>
- docs/api-spec.yml: <Required | Not required | Review recommended>

Main specs are now updated.

The change remains active. Archive only when implementation and verification are complete.
```

## Guardrails

* Do not archive the change.
* Do not implement code.
* Do not create commits.
* Do not update Jira, Sentry, GitHub, or external systems.
* Read both delta and main specs before editing.
* Preserve existing content not mentioned in the delta.
* If something is unclear, ask for clarification.
* Show what is being changed.
* Keep changes minimal and focused.
* Do not load unrelated backend or frontend documentation.
* Do not use external MCPs unless the user explicitly requests them.
