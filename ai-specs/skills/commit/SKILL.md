
name: commit
description: Create focused commits and GitHub pull requests following repository standards and the local OpenSpec SDD workflow.
author: Marcel Carrillo
version: 1.0.0
--------------

# commit Skill

Use this skill when the user wants to create a focused commit and, when appropriate, push the branch and create or update a GitHub Pull Request.

This skill is designed for a local/private OpenSpec SDD workflow using Git and GitHub.

Jira is not required.

Sentry is not required.

GitHub is allowed when configured through local Git remotes and/or GitHub CLI.

## Role

You are an expert in version control, GitHub workflows, and spec-driven development release hygiene.

You create clear, focused commits and Pull Requests that make review, traceability, and rollback straightforward.

## Project Context

This project is a women's fashion ecommerce platform using supplier-fulfilled ecommerce.

Important domain rules:

* `CustomerOrder` and `SupplierOrder` are different concepts.
* `ProductVariant` is the sellable unit of the catalog.
* Supplier costs and internal supplier data must not be exposed through customer-facing APIs.
* Customer-facing order status and internal fulfillment status must remain separate.
* Technical artifacts, commit messages, and PR descriptions must be written in English.

## Arguments

`$ARGUMENTS` is optional.

It may contain:

* Nothing: stage and commit all relevant changes in the working tree, then push and create or update a PR.
* OpenSpec change name: for example `product-catalog-management`.
* Feature label: for example `product-catalog`.
* Branch name: for example `feature/product-catalog-management`.
* Scope label: for example `backend`, `frontend`, `docs`, `catalog`.
* Description-only mode: if the user explicitly says `dry run`, `no git`, `do not commit`, `only description`, `only message`, `just the message`, or similar, do not run modifying Git or GitHub commands.

## Recommended SDD Position

This skill should normally run after:

```text
/enrich-us
/ff
/apply
/verify
/adversarial-review
/archive
```

Do not create the final feature commit if verification has failed or if the adversarial review found blockers or major issues, unless the user explicitly asks to commit the current work in progress.

If OpenSpec artifacts exist for the current change, check whether implementation, verification, documentation, and archive status are consistent before committing.

## Workflow

### 0. Check for description-only / no-git mode first

If the user explicitly requested no Git operations:

* Do not run:

  * `git add`
  * `git commit`
  * `git push`
  * `gh pr create`
  * `gh pr edit`
* Inspect state only if needed.
* Output:

  1. Files that would be staged.
  2. Proposed commit message.
  3. Proposed PR title and body if applicable.
* Then stop.

### 1. Inspect current Git state

Run:

```bash
git status
git branch --show-current
git remote -v
```

Then inspect changes:

```bash
git diff --stat
git diff
git diff --staged --stat
git diff --staged
```

Use selective inspection. Do not read unrelated files.

Identify:

* Current branch.
* Remote repository.
* Modified files.
* Added files.
* Deleted files.
* Staged files.
* Untracked files.
* Whether branch has upstream.
* Whether there are unrelated changes that must not be included.

If the working tree is clean, report that there is nothing to commit and stop.

### 2. Validate repository and remote

Confirm that the remote points to the intended GitHub repository.

Expected repository for this project:

```text
Marcel-Carrillo/ProyectosIA
```

Valid remote examples:

```text
https://github.com/Marcel-Carrillo/ProyectosIA
https://github.com/Marcel-Carrillo/ProyectosIA.git
git@github.com:Marcel-Carrillo/ProyectosIA.git
```

If the remote does not point to the expected repository, stop and ask the user before pushing.

Do not change remote URLs without explicit user approval.

### 3. Resolve scope

#### If `$ARGUMENTS` is empty

Treat all relevant changes as the scope.

Exclude files that should not be committed:

* `.env`
* `.env.local`
* `.env.*.local`
* Secret files
* Local credentials
* Generated logs
* Build outputs
* Dependency folders such as `node_modules`
* Temporary files
* OS/editor artifacts
* Local-only config that should not be versioned

#### If `$ARGUMENTS` is provided

Map the arguments to relevant changes by:

* OpenSpec change name
* Branch name
* File paths
* Feature/module names
* Diff content
* Documentation references
* Test/report files

Stage only matching files or hunks.

If a file contains both relevant and unrelated changes, use patch staging:

```bash
git add -p
```

If no changes clearly match the requested scope, report this and do not commit.

### 4. Check SDD readiness

When the commit is part of an OpenSpec change, inspect relevant files under:

```text
openspec/changes/<change-name>/
```

Check, when applicable:

* `proposal.md`
* `design.md`
* `tasks.md`
* `specs/*/spec.md`
* `reports/`
* archived specs or archive output if the flow already reached archive

Before creating a final feature commit, verify:

* Required tasks are complete.
* Required tests were run.
* curl verification exists for backend endpoint changes when required.
* E2E verification exists for frontend workflow changes when applicable.
* Documentation updates were made when required.
* Adversarial review did not leave blockers or major issues.

If evidence is missing, report it and ask whether to continue.

### 5. Prepare commit message

Commit messages must be in English.

Use Conventional Commit style unless the user requests another convention.

Preferred format:

```text
<type>(<scope>): <imperative summary>
```

Common types:

* `feat`
* `fix`
* `docs`
* `test`
* `refactor`
* `chore`
* `build`
* `ci`

Examples for this project:

```text
docs(specboot): adapt OpenSpec workflow for ecommerce project
feat(product-catalog): add product catalog management
fix(api): prevent supplier cost exposure in product responses
test(orders): add supplier order creation edge cases
chore(git): configure GitHub repository workflow
```

Use the body when useful:

```text
- Summarize relevant changes.
- Mention OpenSpec change name when applicable.
- Mention tests or verification performed.
- Mention documentation updates.
```

Do not mention Jira unless the user explicitly provided a Jira issue.

### 6. Stage changes

Stage only the resolved scope.

For all relevant files:

```bash
git add <files>
```

For partial files:

```bash
git add -p
```

Before committing, run:

```bash
git diff --staged --stat
git diff --staged
```

Verify staged content does not include:

* Secrets
* `.env`
* Credentials
* Generated build artifacts
* Unrelated changes
* Accidental local files
* Internal notes that should not be committed

### 7. Commit

Create the commit:

```bash
git commit
```

or:

```bash
git commit -m "<subject>" -m "<body>"
```

Do not amend previous commits unless the user explicitly asks.

Do not squash commits unless the user explicitly asks.

Do not use `--no-verify` unless the user explicitly asks and understands the risk.

### 8. Push branch

Determine branch name:

```bash
git branch --show-current
```

If the branch has no upstream:

```bash
git push -u origin <branch>
```

If upstream exists:

```bash
git push
```

If push is rejected:

* Do not force push by default.
* Run or suggest:

```bash
git pull --rebase
```

* Resolve conflicts if requested.
* Force push only with explicit user approval.

### 9. Create or update Pull Request

Use GitHub CLI when available:

```bash
gh auth status
gh pr status
```

If no PR exists for the current branch:

```bash
gh pr create
```

Preferred PR title:

```text
<type>(<scope>): <summary>
```

Preferred PR body:

```markdown
## Summary

- <main change>
- <main change>

## OpenSpec

- Change: `<change-name>`

## Verification

- Unit tests: <passed / not applicable / not run>
- API curl tests: <passed / not applicable / not run>
- E2E tests: <passed / not applicable / not run>
- Adversarial review: <passed / not applicable / not run>

## Notes

- <follow-up or "None">
```

If a PR already exists, update it when necessary:

```bash
gh pr view --web
gh pr edit
```

If GitHub CLI is not available or not authenticated, report the push status and provide the PR creation command for the user.

### 10. Summary for the user

Return:

```markdown
## Commit Summary

**Branch**: `<branch>`
**Commit**: `<hash>`
**Remote**: `<remote URL>`

### Files Committed

- `<file>`
- `<file>`

### Scope

<Short explanation of the committed scope>

### Verification

- <tests/checks performed or not applicable>

### Pull Request

<PR URL or instructions to create it>
```

## GitHub Usage

GitHub is allowed for:

* Remote repository verification.
* Branch push.
* Pull Request creation.
* Pull Request update.
* Pull Request inspection.
* Remote branch comparison.

Use GitHub CLI by default when available.

GitHub MCP may be used only when it is configured in the current agent environment and the user explicitly asks for MCP-based GitHub operations.

Do not assume that GitHub MCP configured in Cursor is available in Claude Code.

## External Tools

* Jira: do not use unless the user explicitly asks and provides a Jira issue.
* Sentry: do not use unless the project is deployed, Sentry is configured, and the user explicitly asks for runtime error review.
* Context7: not normally needed for commit creation. Use only if official GitHub/Git behavior documentation is needed and Context7 is available in the current environment.

## Guardrails

* Do not commit secrets.
* Do not commit `.env` files.
* Do not commit generated build artifacts unless explicitly required.
* Do not commit unrelated changes.
* Do not create commits on the wrong branch.
* Do not push to the wrong remote.
* Do not force push without explicit user approval.
* Do not create or update a PR if the user asked for commit-only mode.
* Do not require Jira, Sentry, or external MCPs.
* Do not assume Cursor MCPs are available to Claude Code.
* Do not bypass failing verification unless the user explicitly asks for a work-in-progress commit.
* Keep commits focused and reviewable.
