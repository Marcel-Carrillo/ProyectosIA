---

name: meta-prompt
description: Rewrite prompts using prompt-engineering best practices for precise, scoped, project-aware results in the local OpenSpec SDD workflow.
author: Marcel Carrillo
version: 1.0.0
--------------

# meta-prompt Skill

Use this skill when the user wants to improve, rewrite, structure, or clarify a prompt before giving it to an AI coding assistant such as Claude Code, Cursor, ChatGPT, Codex, or Gemini.

This skill transforms rough prompts into precise, scoped, actionable prompts.

It does not execute the prompt.

It only rewrites it.

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

## When To Use

Use this skill when the user asks for:

* A better prompt.
* A prompt for Claude Code.
* A prompt for Cursor.
* A prompt for ChatGPT.
* A prompt for Codex or Gemini.
* A prompt to create an OpenSpec change.
* A prompt to implement a feature.
* A prompt to review code.
* A prompt to debug.
* A prompt to update documentation.
* A prompt to ask an agent/subagent to perform a specific task.

Example user requests:

```text
Improve this prompt.
Make this prompt better for Claude Code.
Rewrite this for Cursor.
Create a prompt for implementing product catalog management.
Make this prompt precise.
Adapt this prompt to OpenSpec.
```

## Input

The user provides an original prompt.

If `$ARGUMENTS` is provided, use it as the original prompt.

If no prompt is provided, ask the user to paste the prompt.

Do not invent a task.

Do not execute the task described in the prompt.

## Objective

Rewrite the original prompt so that it is:

* Precise.
* Scoped.
* Actionable.
* Project-aware.
* Tool-aware.
* Safe.
* Testable.
* Efficient with context.
* Clear about what must not be changed.

The rewritten prompt must preserve the user's original intention.

Do not add unrelated requirements.

Do not introduce new technologies, libraries, architecture, or workflows unless the original prompt asks for them or the user explicitly approves.

## Output Language

Use English for the rewritten prompt.

Use Spanish only for brief explanatory notes to the user outside the rewritten prompt.

Technical artifacts must be in English.

## Prompt Structure

When rewriting the prompt, use this structure unless another format is clearly better:

```markdown
# Role

<Define the role the assistant should adopt.>

# Objective

<Explain exactly what needs to be achieved.>

# Project Context

<Include only the relevant project context.>

# Scope

<Define what is included.>

# Out of Scope

<Define what must not be touched.>

# Required Context

<List the specific files or folders that should be read.>

# Constraints

<List technical, architectural, business, security, and workflow constraints.>

# Expected Output

<Define the final response format or deliverable.>

# Verification

<Define how the result should be checked.>

# Guardrails

<Define what the assistant must not do.>
```

## Selective Context Loading

Prompts must encourage selective context loading.

Do not tell the assistant to read the whole repository unless the user explicitly asks for a full audit or full migration.

Use task-specific context.

### Backend prompt context

Use only when backend is relevant:

```text
docs/base-standards.md
docs/backend-standards.md
docs/data-model.md
docs/api-spec.yml
docs/openspec-tasks-mandatory-steps.md
ai-specs/agents/backend-developer.md
```

### Frontend prompt context

Use only when frontend is relevant:

```text
docs/base-standards.md
docs/frontend-standards.md
docs/api-spec.yml
docs/openspec-tasks-mandatory-steps.md
ai-specs/agents/frontend-developer.md
```

### Product / OpenSpec prompt context

Use only when product definition or spec refinement is relevant:

```text
docs/base-standards.md
docs/data-model.md
docs/api-spec.yml
openspec/config.yaml
docs/openspec-tasks-mandatory-steps.md
ai-specs/agents/product-strategy-analyst.md
```

### Documentation prompt context

Use only when documentation is relevant:

```text
docs/base-standards.md
docs/documentation-standards.md
```

### Git / commit / PR prompt context

Use only when GitHub, branches, commits, or PRs are relevant:

```text
ai-specs/skills/commit/SKILL.md
ai-specs/skills/using-git-worktrees/SKILL.md
```

## Prompt Types

### 1. OpenSpec change prompt

Use when the user wants to create or refine a spec before implementation.

The prompt should include:

* Change name.
* Business goal.
* Actors.
* Functional requirements.
* Acceptance criteria.
* Edge cases.
* API impact.
* Data model impact.
* Frontend impact.
* Backend impact.
* Testing requirements.
* Documentation impact.
* Non-goals.
* Open questions.

It should explicitly say:

```text
Do not implement code yet.
Do not create commits.
Do not use Jira.
Keep the change focused.
Use OpenSpec artifacts.
```

### 2. Implementation prompt

Use when the user wants code changes.

The prompt should include:

* OpenSpec change to implement.
* Exact scope.
* Files to inspect.
* Files likely to modify.
* Business rules.
* Testing requirements.
* Documentation update requirements.
* Verification steps.

It should explicitly say:

```text
Do not change the approved stack.
Do not introduce new dependencies without approval.
Do not expose supplier internal data.
Do not skip tests.
Do not commit unless explicitly requested.
```

### 3. Debugging prompt

Use when the user wants to diagnose an error.

The prompt should include:

* Error message.
* Current behavior.
* Expected behavior.
* Relevant files/logs.
* Reproduction steps.
* What has already been tried.
* Constraints.
* Desired output.

It should explicitly ask for:

* Root cause analysis.
* Minimal fix.
* Verification steps.
* Risks or side effects.

### 4. Code review prompt

Use when the user wants review or audit.

The prompt should include:

* Review scope.
* Relevant branch or files.
* Standards to apply.
* Business rules to verify.
* Security checks.
* Testing checks.
* Documentation checks.
* Output format with severity levels.

It should explicitly say:

```text
Do not modify files.
Do not create commits.
Do not use Jira or Sentry unless explicitly requested.
Use GitHub only if branch, PR, or remote comparison is relevant.
Use Context7 only if available and official documentation is needed.
```

### 5. Documentation prompt

Use when the user wants docs updated.

The prompt should include:

* Documents to inspect.
* Documents to update.
* Change summary.
* Related feature/spec.
* API/data model impact.
* Required consistency checks.

It should explicitly say:

```text
Use English for documentation.
Do not rewrite unrelated sections.
Keep changes minimal and accurate.
```

### 6. GitHub / commit prompt

Use when the user wants commits or PRs.

The prompt should include:

* Branch.
* Scope.
* Files to include.
* Files to exclude.
* Commit style.
* PR title/body expectations.
* Verification status.

It should explicitly say:

```text
Do not commit secrets.
Do not include .env files.
Do not force push.
Verify the remote points to Marcel-Carrillo/ProyectosIA before pushing.
```

## External Tools

Generated prompts may mention external tools only when relevant.

* GitHub: allowed when branch, commit, PR, or remote repository state is relevant.
* Context7: allowed only when available in the current agent environment and official, up-to-date documentation is needed.
* Jira: do not include unless the user explicitly asks for Jira.
* Sentry: do not include unless the project is deployed, Sentry is configured, and the user explicitly asks for runtime error review.
* Browser MCP / Playwright MCP: include only when frontend demonstration or E2E verification is relevant and available.

Do not assume MCPs configured in Cursor are available in Claude Code.

## Rewriting Rules

When rewriting a prompt:

1. Preserve the user's original objective.
2. Remove ambiguity.
3. Add relevant project context.
4. Add explicit scope and non-goals.
5. Add relevant constraints.
6. Add expected output format.
7. Add verification requirements.
8. Add guardrails.
9. Keep it concise enough to be usable.
10. Avoid overloading the prompt with unrelated docs or tools.

## Output Format

Return:

````markdown
## Improved Prompt

```text
<rewritten prompt>
````

## Notes

* <Brief note about what was clarified or constrained>
* <Any assumption made>

````

If no assumptions were made, write:

```text
No assumptions added.
````

## Guardrails

* Do not execute the rewritten prompt.
* Do not edit files.
* Do not run commands.
* Do not create specs.
* Do not implement code.
* Do not create commits.
* Do not add Jira unless explicitly requested.
* Do not add Sentry unless explicitly requested.
* Do not add new technologies or dependencies unless explicitly requested.
* Do not broaden the user's request.
* Do not tell the assistant to read the whole repository unless the user explicitly requested a full-repository task.
* Do not assume Cursor MCPs are available in Claude Code.
* Keep generated prompts aligned with the current project standards.
* Keep technical output in English.

# Original prompt

$ARGUMENTS
