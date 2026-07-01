---

name: using-git-worktrees
description: Use when starting feature work that should be isolated from the current workspace using a feature branch or an optional Git worktree.
author: Marcel Carrillo
version: 1.0.0
--------------

# Using Git Worktrees Skill

Use this skill when starting feature work that needs isolation from the current workspace.

This project uses a local/private OpenSpec SDD workflow with Cursor, Claude Code, Git, and GitHub.

Git worktrees are optional.

Feature branches are the default isolation mechanism.

Use Git worktrees only when the user explicitly wants a separate working directory or when the current workspace contains unrelated work that should not be mixed with the new feature.

## Purpose

Protect the main workspace from accidental changes while working on OpenSpec features.

Recommended workflow:

```text
/enrich-us
/ff
create feature branch or worktree
/apply
/verify
/adversarial-review
/commit
push branch
create PR
/archive
```

## Spec-Driven Integration

Use this skill as the isolation gate before implementation work starts.

When integrated with OpenSpec commands:

* During `/opsx:propose`: decide branch/worktree strategy for the upcoming change and state the target branch name.
* During `/opsx:apply`: ensure the change runs in an isolated branch/worktree before editing files.
* In `tasks.md`: keep "Step 0: Create Feature Branch" as mandatory. If a worktree is used, Step 0 still applies to the branch inside that worktree.
* During `/opsx:archive`: do not remove worktrees automatically. Cleanup is explicit and only after merge/close confirmation.

The goal is deterministic isolation without changing the mandatory OpenSpec task order.

## Project Context

Repository:

```text
Marcel-Carrillo/ProyectosIA
```

Main project folders:

```text
docs/
ai-specs/
openspec/
```

This project is a women's fashion ecommerce platform using supplier-fulfilled ecommerce.

Critical business rules:

* `CustomerOrder` and `SupplierOrder` are different concepts.
* `ProductVariant` is the sellable unit.
* Supplier costs and internal supplier data must not be exposed through customer-facing APIs.
* Customer-facing order status and internal fulfillment status must remain separate.
* The first version prioritizes manual supplier order processing over premature automation.

## Isolation Strategy

Use this priority order:

1. If already on a suitable feature branch, continue there.
2. If on `main`, `master`, or `develop`, create a feature branch **from `develop`** — `develop` is the integration branch that all feature branches must fork from and PR back into. If currently on `main`/`master`, run `git fetch origin && git checkout develop && git pull` first, then branch from `develop`. Never branch directly from `main`/`master` for feature work.
3. If the user explicitly requests a separate directory, create a Git worktree.
4. If the workspace has unrelated local changes, ask whether to create a worktree before starting.
5. Do not create a worktree automatically without user approval.

## When To Use a Feature Branch

Use a normal feature branch when:

* The workspace is clean.
* The task is small or medium.
* The user does not need multiple parallel working directories.
* Cursor and Claude Code are already open in the project root.

Example branch names:

```text
feature/product-catalog-management
feature/supplier-management
feature/customer-orders
docs/specboot-workflow
chore/github-setup
```

## When To Use a Git Worktree

Use a Git worktree when:

* The user explicitly asks for a worktree.
* There are unrelated local changes that should not be mixed.
* The user wants to work on multiple features in parallel.
* A risky experiment should be isolated from the main checkout.

Default worktree location:

```text
<repo>/.worktrees/<branch-name>
```

The `.worktrees/` directory must be ignored by Git.

## Step 0: Detect Existing Isolation and Inspect Current State

Before creating anything, detect whether you are already in an isolated workspace.

Run:

```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
BRANCH=$(git branch --show-current)
```

Submodule guard:

```bash
git rev-parse --show-superproject-working-tree 2>/dev/null
```

Interpretation:

* If `GIT_DIR != GIT_COMMON` and the submodule command returns empty, you are already in a linked worktree.
  * Continue in this isolated workspace.
  * Do not create another worktree.
* If `GIT_DIR == GIT_COMMON` (or you are in a submodule), treat as normal checkout and continue with inspection/decision steps below.

Then inspect repository state:

Run:

```bash
git status
git branch --show-current
git remote -v
```

Also check worktree state:

```bash
git worktree list
```

Identify:

* Current branch.
* Whether the working tree is clean.
* Whether there are unrelated changes.
* Whether the remote points to `Marcel-Carrillo/ProyectosIA`.
* Whether the current branch is `main`, `master`, or already a feature branch.

If already in a linked worktree, report:

```text
Already in isolated workspace at <path> on branch <name>.
```

If the remote does not point to the expected repository, stop and ask the user before continuing.

Expected remote examples:

```text
https://github.com/Marcel-Carrillo/ProyectosIA
https://github.com/Marcel-Carrillo/ProyectosIA.git
git@github.com:Marcel-Carrillo/ProyectosIA.git
```

## Step 1: Decide Branch or Worktree (Spec-Driven)

### If already on a suitable feature branch

Continue in the current branch.

Report:

```text
Already on feature branch: <branch-name>
```

### If on `main` or `master`

Never branch directly from `main`/`master`. First switch to `develop` and update it, then branch from there, unless the user asked for a worktree.

Example:

```bash
git fetch origin
git checkout develop
git pull
git checkout -b feature/<change-name>
```

### If on `develop`

Update it first, then branch from it directly:

```bash
git pull
git checkout -b feature/<change-name>
```

### If unrelated changes exist

Do not continue silently.

Ask the user:

```text
There are existing local changes that may be unrelated to this task. Do you want to create an isolated worktree for the new feature, continue in the current workspace, or stop?
```

### If user wants a worktree

Proceed to Step 2.

### If this is an OpenSpec implementation (`/opsx:apply`)

Resolve `<change-name>` and use:

```text
feature/<change-name>
```

as the default branch name for either standard branch mode or worktree mode.

## Step 2: Create Git Worktree

Use this only after user approval.

### 2.1 Ensure `.worktrees/` is ignored

Check:

```bash
git check-ignore -q .worktrees
```

If `.worktrees/` is not ignored, add it to `.gitignore`:

```bash
echo ".worktrees/" >> .gitignore
```

Then commit this change separately before creating the worktree, or ask the user if it should be included in the current setup commit.

Do not create a worktree inside a tracked directory.

### 2.2 Create the worktree

From the main repository root:

```bash
SOURCE_ROOT=$(git rev-parse --show-toplevel)
LOCATION="$SOURCE_ROOT/.worktrees"
BRANCH_NAME="feature/<change-name>"

mkdir -p "$LOCATION"
git worktree add "$LOCATION/$BRANCH_NAME" -b "$BRANCH_NAME"
cd "$LOCATION/$BRANCH_NAME"
```

If the shell does not support Bash syntax, use equivalent PowerShell commands or ask the user to run the commands manually.

PowerShell equivalent:

```powershell
$SOURCE_ROOT = git rev-parse --show-toplevel
$LOCATION = Join-Path $SOURCE_ROOT ".worktrees"
$BRANCH_NAME = "feature/<change-name>"
$WORKTREE_PATH = Join-Path $LOCATION $BRANCH_NAME

New-Item -ItemType Directory -Force -Path $LOCATION
git worktree add $WORKTREE_PATH -b $BRANCH_NAME
Set-Location $WORKTREE_PATH
```

### 2.3 Copy local Claude settings only if needed

If the user expects Claude Code behavior to match the main checkout, copy local Claude settings when they exist:

```bash
for claude_settings in ".claude/settings.json" ".claude/settings.local.json"; do
  if [ -f "$SOURCE_ROOT/$claude_settings" ]; then
    mkdir -p ".claude"
    cp -p "$SOURCE_ROOT/$claude_settings" "./$claude_settings"
  fi
done
```

Do not copy secrets.

Do not copy unrelated local files.

If `.claude/skills` or `.cursor` uses symlinks, verify that the worktree still resolves the same project-relative paths.

## Step 3: Project Setup

Do not install dependencies automatically.

Do not run `npm install`, `npm ci`, `docker-compose`, migrations, or build commands unless the user explicitly approves.

Instead, detect what would be needed and report it.

Examples:

```text
Detected package.json. Dependency installation may be required.
Detected docker-compose.yml. Database startup may be required.
Detected prisma/schema.prisma. Prisma generation or migration may be required.
```

If the user approves setup, run only project-defined commands.

Prefer:

```bash
npm ci
```

over:

```bash
npm install
```

when `package-lock.json` exists.

## Step 4: Baseline Verification

Baseline verification is recommended but not always mandatory.

Run baseline checks only when the relevant project code exists and the user approves command execution.

Possible commands:

```bash
npm test
npm run lint
npm run typecheck
```

Do not invent commands.

Check `package.json` first.

If no backend/frontend code exists yet, report:

```text
No application code detected yet. Baseline tests are not applicable.
```

If tests fail, report the failure and ask whether to investigate or proceed.

Do not proceed silently on failing baseline tests.

## Step 5: Worktree Cleanup

Clean up a worktree only when the user explicitly confirms the worktree is no longer needed.

Never remove a worktree with unsaved work.

### 5.1 Verify there is no work to lose

Inside the worktree:

```bash
git status --porcelain
git log @{u}.. 2>/dev/null
```

If either command returns output:

* Stop.
* Report uncommitted or unpushed work.
* Ask whether to commit, push, stash, or discard.

Do not force-remove anything without explicit confirmation.

### 5.2 Remove the worktree

Move outside the worktree first.

Then run:

```bash
git worktree remove <worktree-path>
git worktree prune
```

Only force-remove if the user explicitly confirms:

```bash
git worktree remove --force <worktree-path>
```

### 5.3 Delete branch only when safe

Prefer safe delete:

```bash
git branch -d <branch-name>
```

Use force delete only with explicit confirmation:

```bash
git branch -D <branch-name>
```

Do not delete remote branches unless the user asks.

## GitHub Integration

GitHub is allowed for:

* Verifying the remote repository.
* Pushing feature branches.
* Creating Pull Requests through `gh`.
* Inspecting PR status.

Use GitHub CLI when available:

```bash
gh auth status
gh pr status
```

Do not require GitHub MCP.

GitHub MCP may be used only when configured in the current agent environment and explicitly requested by the user.

Do not assume GitHub MCP configured in Cursor is available in Claude Code.

## Context7

Context7 is not normally needed for branch or worktree setup.

Use Context7 only when:

* It is available in the current agent environment.
* Official, up-to-date Git, GitHub, Claude Code, or OpenSpec documentation is needed.
* The user explicitly asks for documentation-backed verification.

Do not assume Context7 configured in Cursor is available in Claude Code.

## Output Format

When preparing a feature branch or worktree, return:

```markdown
## Workspace Isolation Summary

**Mode**: Feature branch | Git worktree | Current workspace
**Branch**: `<branch-name>`
**Path**: `<path>`
**Remote**: `<remote-url>`

### Repository State

- Working tree: <clean / has existing changes>
- Upstream: <configured / not configured>
- Remote target: <verified / needs review>

### Setup

- Dependency install: <not run / run / not applicable>
- Baseline tests: <not run / passed / failed / not applicable>

### Next Step

<Recommended next command or action>
```

When cleaning up a worktree, return:

```markdown
## Worktree Cleanup Summary

**Worktree removed**: `<path>`
**Branch**: `<branch-name>`
**Branch deleted**: Yes | No
**Remote branch deleted**: Yes | No

### Safety Checks

- Uncommitted changes: None | Present
- Unpushed commits: None | Present
- User confirmation: Yes | No
```

## Guardrails

* Do not create a worktree without user approval.
* Do not create a worktree if a normal feature branch is sufficient unless the user asks.
* Do not install dependencies automatically.
* Do not run migrations automatically.
* Do not run Docker commands automatically.
* Do not run modifying setup commands without user approval.
* Do not remove worktrees with unsaved work.
* Do not force delete branches without explicit confirmation.
* Do not force push.
* Do not change Git remotes without explicit confirmation.
* Do not push to a remote that is not verified as the expected repository.
* Do not assume Cursor MCPs are available in Claude Code.
* Do not require Jira, Sentry, or external MCPs.
* Keep workspace isolation proportional to task complexity.
