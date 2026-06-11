---

name: explain
description: Teach underlying concepts with clear mental models to close skill gaps behind user questions, using project-aware and token-efficient explanations.
author: Marcel Carrillo
version: 1.0.0
--------------

# explain Skill

Use this skill when the user wants to understand a concept, tool, workflow, error, architecture decision, or technical mechanism behind a question.

This skill is for **learning and conceptual clarity**, not for implementation.

It should help the user understand how the system works and why it behaves a certain way.

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
* `ProductVariant` is the sellable unit.
* Supplier costs and internal supplier data must not be exposed through customer-facing APIs.
* Customer-facing order status and internal fulfillment status must remain separate.

## When To Use

Use this skill for questions such as:

* "What is this for?"
* "Why does this happen?"
* "How does this workflow work?"
* "What is the difference between X and Y?"
* "Why should I use branches/worktrees?"
* "What is OpenSpec doing here?"
* "How does Claude Code differ from Cursor?"
* "What does this Git error mean?"
* "Why do we separate CustomerOrder and SupplierOrder?"
* "Why do we need data-model.md and api-spec.yml?"

Do not use this skill when the user asks directly to edit a file, create a spec, implement code, commit changes, or run a workflow. In those cases, use the appropriate implementation or workflow skill.

## Input Handling

If `$ARGUMENTS` is provided, use it as the topic.

If no arguments are passed, use the current conversation context.

If the topic is unclear, ask the user what they want explained.

Do not invent a topic.

## Selective Context Loading

Use selective context loading.

Do not read the entire repository.

Read only what is needed to explain the topic.

Recommended sources:

### General project explanation

* `docs/base-standards.md`
* `README.md`

### Backend concept

* `docs/backend-standards.md`
* `docs/data-model.md`
* `docs/api-spec.yml`

### Frontend concept

* `docs/frontend-standards.md`
* `docs/api-spec.yml`

### OpenSpec / SDD concept

* `openspec/config.yaml`
* `docs/openspec-tasks-mandatory-steps.md`
* Relevant files under `ai-specs/skills/`

### GitHub / commit / branch concept

* `ai-specs/skills/commit/SKILL.md`
* `ai-specs/skills/using-git-worktrees/SKILL.md`

### Documentation concept

* `docs/documentation-standards.md`

Do not load frontend docs for backend-only concepts unless frontend impact is relevant.

Do not load backend docs for frontend-only concepts unless API/backend impact is relevant.

## External Tools

External tools are optional.

* Context7: use only when it is available in the current agent environment and official, up-to-date library documentation is needed.
* GitHub: use only when repository, branch, PR, or remote GitHub state is relevant.
* Jira: do not use unless the user explicitly asks for Jira.
* Sentry: do not use unless the project is deployed, Sentry is configured, and the user asks about runtime error review.

Do not assume that MCPs configured in Cursor are available in Claude Code.

## Explanation Principles

When explaining, optimize for:

* Conceptual clarity.
* Mental models.
* Transferable understanding.
* Practical reasoning.
* Correct terminology.
* Relevance to the user's project.

Avoid:

* Marketing language.
* Motivational filler.
* Overly broad theory.
* Unexplained checklists.
* Blind procedural steps without explanation.
* Speculative APIs or unsupported claims.

If uncertain, say what is uncertain and what would need to be checked.

## Response Structure

Use this structure when appropriate.

### 1. Concept Summary

Explain:

* What the concept is.
* Why it exists.
* Where it appears in the project or workflow.
* What problem it solves.

Keep it concise but complete.

### 2. Mental Model

Provide one simple mental model.

Examples:

```text
Git branch = separate timeline of changes.
Git worktree = separate folder attached to a separate branch.
OpenSpec change = planned contract before implementation.
CustomerOrder = what the customer bought.
SupplierOrder = what the store asks the supplier to fulfill.
```

Use ASCII or simple flow diagrams when useful.

### 3. Practical Example

Give one practical example tied to this project.

Examples:

* Product catalog feature.
* Supplier order workflow.
* GitHub PR flow.
* Claude Code + Cursor workflow.
* API spec and data model alignment.

Code snippets are allowed only when they help explain the concept and do not turn the answer into an implementation task.

### 4. Alternatives and Trade-offs

When relevant, explain 2–4 alternatives.

For each alternative:

* What it is.
* When it fits.
* When it is worse.
* Trade-offs in complexity, maintainability, safety, or speed.

### 5. Common Mistakes

List common misconceptions or mistakes.

Examples:

* Thinking Cursor MCPs are automatically available to Claude Code.
* Treating `Product` as the sellable unit instead of `ProductVariant`.
* Mixing customer order status with fulfillment status.
* Running `/apply` before reviewing OpenSpec artifacts.
* Creating commits before `/verify` and `/adversarial-review`.

### 6. Optional Quiz

If the user appears to be learning a new concept, provide 3 short questions.

Do not provide answers immediately.

Ask the user to answer first, then provide feedback.

Skip the quiz when the user is asking for quick clarification or an operational decision.

## Output Style

Use Spanish for the conversation unless the user requests otherwise.

Use English for technical artifacts, code, commit messages, PR text, documentation snippets, and copied project content.

Be structured and direct.

## Guardrails

* Do not implement code.
* Do not edit files.
* Do not create commits.
* Do not create branches.
* Do not run commands.
* Do not require Jira, Sentry, or external MCPs.
* Do not assume Cursor MCPs are available to Claude Code.
* Do not over-explain unrelated topics.
* Do not give unsupported API details.
* Do not replace the appropriate workflow skill when the user is asking to perform an action.
* Keep token usage proportional to the question.
* Prefer local project documentation before external references.

## Success Criterion

A successful explanation should let the user reason about similar problems later.

The user should understand:

* What is happening.
* Why it behaves that way.
* What part of the system is responsible.
* What options exist.
* What mistake to avoid next time.

# User prompt

$ARGUMENTS
