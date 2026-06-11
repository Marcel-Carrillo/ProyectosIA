---
name: writing-skills
description: Use when creating, editing, reviewing, or validating local project skills for Claude Code, Cursor, OpenSpec, or AI workflow automation.
author: Marcel Carrillo
version: 1.0.0
---

# writing-skills Skill

Use this skill when creating, editing, reviewing, or validating local skills for this project.

This project uses local skills to guide Claude Code, Cursor, OpenSpec, GitHub workflows, documentation updates, audits, reviews, and implementation support.

Skills must be precise, scoped, project-aware, safe, and efficient.

## Project Context

This project is a women's fashion ecommerce platform using supplier-fulfilled ecommerce.

The project uses:

* Cursor
* Claude Code
* OpenSpec / Spec-Driven Development
* Git and GitHub
* Optional Context7 when available in the current agent environment
* No required Jira workflow
* No required Sentry workflow at the current stage

Technical stack:

* Backend: Node.js, TypeScript, Express, Prisma, PostgreSQL
* Frontend: React, TypeScript, Create React App, React Router, React Bootstrap, Bootstrap, Axios
* Testing: Jest, React Testing Library, Cypress, curl endpoint verification when applicable
* Architecture: DDD with Presentation, Application, Domain, and Infrastructure layers

Important business rules:

* `CustomerOrder` and `SupplierOrder` are different concepts.
* A customer order may generate one or more supplier orders.
* `ProductVariant` is the sellable unit.
* Supplier costs, supplier credentials, supplier notes, supplier references, and internal fulfillment notes must not be exposed through customer-facing APIs.
* Customer-facing order status and internal fulfillment status must remain separate.
* Payment status, order status, fulfillment status, supplier order status, shipment status, return status, and refund status must not be mixed.
* The first version prioritizes manual supplier order processing over premature automation.

## Canonical Skill Location

Canonical skills live under:

```text
ai-specs/skills/<skill-name>/SKILL.md
```

Agent-facing mirrors may exist under:

```text
.claude/skills
.cursor/skills
```

`ai-specs/skills` is the source of truth.

Use `sync-agent-symlinks` after adding, removing, renaming, or moving skills.

## What Is a Skill?

A skill is a reusable instruction document that teaches an AI agent how to perform a recurring task safely and consistently.

Skills are:

* Workflow guides.
* Process rules.
* Project-specific operational instructions.
* Reusable patterns.
* Safety and verification guardrails.
* Tool usage policies.

Skills are not:

* One-off notes.
* Random chat summaries.
* Long project documentation.
* Full implementation plans.
* Temporary scratchpads.
* Replacement for OpenSpec changes.

## When To Create or Edit a Skill

Create or edit a skill when:

* The same workflow will be used repeatedly.
* The agent needs consistent behavior across sessions.
* A previous agent made the same mistake more than once.
* A workflow needs clear guardrails.
* A tool should be used only under specific conditions.
* A project-specific process should be preserved.

Do not create a skill when:

* The instruction is one-off.
* The content belongs in `docs/`.
* The change is purely feature-specific and belongs in OpenSpec.
* A simple script or validation rule would enforce it better.
* The user only needs a temporary prompt.

## Skill Naming Rules

Skill names should:

* Use lowercase letters, numbers, and hyphens.
* Be short and descriptive.
* Describe the action or workflow.
* Avoid spaces, underscores, parentheses, and special characters.

Good examples:

```text
commit
update-docs
adversarial-review
code-auditing
using-git-worktrees
openspec-sync-specs
sync-agent-symlinks
```

Avoid:

```text
Commit Skill
skill_creation
my(skill)
general-helper
misc
```

## Required File Structure

Each skill should follow this structure:

```text
ai-specs/skills/<skill-name>/
  SKILL.md
```

Optional supporting files are allowed only when useful:

```text
ai-specs/skills/<skill-name>/
  SKILL.md
  references/
    <reference-file>.md
  examples/
    <example-file>.md
  scripts/
    <script-file>
```

Use supporting files only for:

* Long references.
* Reusable examples.
* Scripts.
* Heavy documentation that would make `SKILL.md` too large.

Keep the main `SKILL.md` focused.

## Frontmatter

Each `SKILL.md` must start with YAML frontmatter.

Required fields:

```yaml
---
name: <skill-name>
description: Use when <specific triggering condition>
author: Marcel Carrillo
version: 1.0.0
---
```

Rules:

* `name` must match the skill folder name.
* `description` should explain when to use the skill.
* `description` should start with `Use when`.
* `description` should not summarize the entire workflow.
* `author` should be `Marcel Carrillo`.
* `version` should use semantic-style numbering such as `1.0.0`.

Example:

```yaml
---
name: update-docs
description: Use when project documentation must be updated after code, API, data model, OpenSpec, or workflow changes.
author: Marcel Carrillo
version: 1.0.0
---
```

## Description Rules

The description is important because agents use it to decide whether to load the skill.

Good descriptions:

```yaml
description: Use when project documentation must be updated after code, API, data model, OpenSpec, or workflow changes.
description: Use when creating focused commits and GitHub pull requests after local verification.
description: Use when reviewing implemented changes for spec alignment, safety, ecommerce correctness, and release readiness.
```

Bad descriptions:

```yaml
description: This skill stages files, writes a commit, pushes, creates a PR, checks verification, and reports the URL.
description: A useful skill for docs.
description: General helper.
```

Why:

* Descriptions should trigger loading.
* They should not replace the full skill body.
* They should not encourage shortcuts.

## Recommended SKILL.md Structure

Use this structure unless the skill clearly needs something different:

```markdown
# <skill-name> Skill

<One short paragraph explaining the purpose.>

## Project Context

<Only include project context relevant to this skill.>

## When To Use

<Specific triggers and situations.>

## Inputs

<Arguments, files, or context the skill expects.>

## Selective Context Loading

<Which files to read and when.>

## Workflow

<Steps to follow.>

## Output Format

<Expected final response or report format.>

## External Tools

<Which tools are allowed, optional, forbidden, or conditional.>

## Guardrails

<What the agent must not do.>
```

## Selective Context Loading

Every skill should avoid loading the whole repository.

Prefer task-specific context.

### Backend-related skill context

Use only when backend is relevant:

```text
docs/base-standards.md
docs/backend-standards.md
docs/data-model.md
docs/api-spec.yml
docs/openspec-tasks-mandatory-steps.md
```

### Frontend-related skill context

Use only when frontend is relevant:

```text
docs/base-standards.md
docs/frontend-standards.md
docs/api-spec.yml
docs/openspec-tasks-mandatory-steps.md
```

### Documentation-related skill context

Use only when documentation is relevant:

```text
docs/base-standards.md
docs/documentation-standards.md
```

### OpenSpec-related skill context

Use only when OpenSpec is relevant:

```text
openspec/config.yaml
docs/openspec-tasks-mandatory-steps.md
openspec/changes/<change-name>/
openspec/specs/
```

### GitHub / Git-related skill context

Use only when Git, branches, commits, or PRs are relevant:

```text
ai-specs/skills/commit/SKILL.md
ai-specs/skills/using-git-worktrees/SKILL.md
```

Do not instruct agents to read the whole repository unless the user explicitly requests a full audit or full migration.

## External Tool Policy

Skills should be explicit about external tools.

### GitHub

Allowed when:

* Branches are relevant.
* Commits are relevant.
* Pull Requests are relevant.
* Remote repository state is relevant.

Prefer Git and GitHub CLI when available.

Do not require GitHub MCP unless explicitly configured and requested.

### Context7

Allowed only when:

* It is available in the current agent environment.
* Official, up-to-date documentation is needed.
* Local project documentation is insufficient.

Do not assume Context7 configured in Cursor is available in Claude Code.

### Jira

Do not include Jira unless the user explicitly asks for Jira.

### Sentry

Do not include Sentry unless:

* The project is deployed.
* Sentry is configured.
* The user explicitly asks for runtime error review.

### Browser MCP / Playwright MCP

Allowed only when:

* Frontend behavior needs to be demonstrated or verified.
* The MCP is available in the current environment.
* The task benefits from browser automation.

Do not require browser MCP for general skills.

## Project-Specific Guardrails

Skills must protect these project decisions:

* Do not change the approved stack without explicit user approval.
* Do not introduce new dependencies without explicit user approval.
* Do not replace OpenSpec workflow without explicit user approval.
* Do not require Jira.
* Do not require Sentry.
* Do not assume Cursor MCPs are available in Claude Code.
* Do not expose supplier costs or internal supplier data through customer-facing behavior.
* Do not mix `CustomerOrder` and `SupplierOrder`.
* Do not treat `Product` as the sellable unit when the behavior belongs to `ProductVariant`.
* Do not mix order, payment, fulfillment, supplier order, shipment, return, or refund statuses.
* Do not automate supplier fulfillment prematurely in the first version.

## Writing Style

Use:

* Clear headings.
* Short paragraphs.
* Concrete guardrails.
* Explicit allowed/forbidden actions.
* English for technical artifacts.
* Spanish only in chat responses when talking to the user.

Avoid:

* Long theory sections.
* Project-irrelevant examples.
* External vendor references unless needed.
* Overly broad instructions.
* Hidden assumptions.
* Ambiguous phrases like "handle appropriately" or "use best practices" without specifics.

## Skill Testing

Skill testing should be proportional.

For small local edits:

* Check frontmatter.
* Check triggers.
* Check scope.
* Check guardrails.
* Check tool policy.
* Check that it does not conflict with project standards.

For workflow-critical skills:

* Test with one or more realistic scenarios.
* Confirm the skill would prevent known failure modes.
* Confirm it does not encourage over-reading context.
* Confirm it does not require unavailable tools.
* Confirm it respects project guardrails.

For high-risk skills such as `commit`, `adversarial-review`, `code-auditing`, or `show-spec-working`:

* Include dry-run behavior when relevant.
* Include safety checks.
* Include explicit non-destructive defaults.
* Include a clear report format.
* Include external tool limitations.

Do not impose heavy subagent testing for every small local edit unless the user asks for strict validation.

## Common Skill Failure Modes

| Failure Mode                                   | Correction                             |
| ---------------------------------------------- | -------------------------------------- |
| Skill requires Jira by default                 | Make Jira optional and explicit-only   |
| Skill assumes Sentry exists                    | Make Sentry optional and future-only   |
| Skill assumes Cursor MCPs exist in Claude Code | Add environment-specific MCP guardrail |
| Skill reads the whole repository               | Add selective context loading          |
| Skill changes files when it should only review | Add non-modification guardrail         |
| Skill commits automatically                    | Require explicit commit workflow       |
| Skill starts services automatically            | Require user approval                  |
| Skill exposes supplier data                    | Add ecommerce data-safety rule         |
| Skill mixes customer and supplier orders       | Add domain consistency rule            |
| Skill has vague output                         | Add explicit output format             |

## Skill Review Checklist

Before accepting a skill, verify:

* [ ] Frontmatter is valid YAML.
* [ ] `name` matches the folder name.
* [ ] `description` starts with `Use when`.
* [ ] `author` is `Marcel Carrillo`.
* [ ] The skill has a clear purpose.
* [ ] The skill defines when to use it.
* [ ] The skill defines when not to use it if relevant.
* [ ] The skill uses selective context loading.
* [ ] The skill has explicit external tool rules.
* [ ] The skill does not require Jira.
* [ ] The skill does not require Sentry.
* [ ] The skill does not assume Cursor MCPs are available in Claude Code.
* [ ] The skill does not introduce new stack choices.
* [ ] The skill protects ecommerce business rules when relevant.
* [ ] The skill has guardrails.
* [ ] The skill has an output format when useful.
* [ ] The skill does not read or modify unrelated areas.
* [ ] The skill does not create commits unless it is the `commit` skill or explicitly says so.
* [ ] The skill is not longer than necessary.

## Supporting Files

Use supporting files when the main `SKILL.md` would become too large.

Recommended folders:

```text
references/
examples/
scripts/
```

Rules:

* Supporting files must be relevant to the skill.
* Do not force-load supporting files unless needed.
* Avoid `@` references that automatically load large files.
* Prefer plain relative references such as `references/audit-methodology.md`.
* Keep examples project-relevant.

## Updating Existing Skills

When editing an existing skill:

1. Preserve the original purpose unless the user asks to change it.
2. Remove obsolete references.
3. Add project context only where useful.
4. Add selective context loading.
5. Add external tool policy.
6. Add guardrails.
7. Keep the skill focused.
8. Validate the frontmatter.
9. Check whether `sync-agent-symlinks` is needed afterward.
10. Summarize what changed.

## Creating a New Skill

When creating a new skill:

1. Define the trigger.
2. Choose a clear skill name.
3. Create the folder under `ai-specs/skills/<skill-name>/`.
4. Create `SKILL.md`.
5. Add valid frontmatter.
6. Add project-aware workflow.
7. Add guardrails.
8. Add output format when useful.
9. Add supporting files only if needed.
10. Run `sync-agent-symlinks` if `.claude/skills` or `.cursor/skills` mirror canonical skills.

## Output Format

When this skill is used to review or create a skill, return:

```markdown
## Skill Review Summary

**Skill**: `<skill-name>`
**Action**: Created | Updated | Reviewed

### Changes

- <change>
- <change>

### Validation

- Frontmatter: Passed | Failed
- Scope: Passed | Failed
- Selective context loading: Passed | Failed
- External tool policy: Passed | Failed
- Project guardrails: Passed | Failed

### Follow-up

- <next action or "None">
```

## Guardrails

* Do not require Jira.
* Do not require Sentry.
* Do not assume Cursor MCPs are available in Claude Code.
* Do not require Context7 for local skill writing.
* Do not require GitHub unless the skill involves branches, commits, PRs, or remote repository state.
* Do not force-load large supporting files.
* Do not use `@` references for large files.
* Do not create multiple unrelated skills in one operation unless the user explicitly asks.
* Do not overfit skills to one-off tasks.
* Do not remove existing safety rules unless replacing them with clearer ones.
* Do not introduce new technologies or workflows without user approval.
* Keep skills short enough to be useful.
