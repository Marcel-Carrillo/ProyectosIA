---

name: sync-agent-symlinks
description: Analyze and synchronize agent skill exposure after ai-specs skill changes. Use when skills are added, removed, renamed, or moved and .claude/skills and .cursor/skills must stay aligned.
author: Marcel Carrillo
version: 1.0.0
--------------

# sync-agent-symlinks Skill

Keep agent-facing skill structures synchronized with `ai-specs/skills` as the canonical source.

Use this skill after any change in `ai-specs/skills`, especially when a skill has been:

* Added
* Removed
* Renamed
* Moved
* Reorganized

This skill ensures that `.claude/skills` and `.cursor/skills` expose the same canonical skills without stale or broken links.

## Project Context

This project uses:

* Cursor
* Claude Code
* OpenSpec / Spec-Driven Development
* Local skill definitions under `ai-specs/skills`
* Agent-facing skill exposure under `.claude/skills` and `.cursor/skills`

Canonical source:

```text
ai-specs/skills
```

Mirror targets:

```text
.claude/skills
.cursor/skills
```

## Core Rule

`ai-specs/skills` is the source of truth.

`.claude/skills` and `.cursor/skills` must mirror the canonical skills by using links to `ai-specs/skills`.

Do not treat `.claude/skills` or `.cursor/skills` as canonical.

## Scope and Safety Rules

Manage only skill entries under:

```text
.claude/skills
.cursor/skills
```

Manage only entries that are intended to point to:

```text
../../ai-specs/skills/<skill-name>
```

Do not modify:

* `.claude/settings.json`
* `.claude/settings.local.json`
* `.cursor/mcp.json`
* `.cursor/rules`
* Any other `.claude` or `.cursor` file outside `skills`

Never delete non-symlink directories automatically.

Never overwrite a real directory automatically.

Never remove external entries automatically.

If an entry is ambiguous, report it as a conflict and ask the user.

## Platform Notes

### Linux/macOS/Git Bash

Prefer symbolic links:

```bash
ln -s ../../ai-specs/skills/<skill-name> .claude/skills/<skill-name>
ln -s ../../ai-specs/skills/<skill-name> .cursor/skills/<skill-name>
```

### Windows / PowerShell

Windows symlink creation may require administrator privileges or Developer Mode.

Preferred PowerShell command when symlinks are available:

```powershell
New-Item -ItemType SymbolicLink -Path ".claude\skills\<skill-name>" -Target "..\..\ai-specs\skills\<skill-name>"
New-Item -ItemType SymbolicLink -Path ".cursor\skills\<skill-name>" -Target "..\..\ai-specs\skills\<skill-name>"
```

If symbolic links are not available, do not silently copy directories.

Ask the user before using alternatives such as:

* directory junctions
* copied directories
* manual setup

Directory junctions may work locally, but they are not equivalent to portable symlinks and may behave differently across tools.

## Workflow

### Step 1: Build Inventories

Collect three inventories:

1. Canonical skills from:

```text
ai-specs/skills/*/SKILL.md
```

2. Mirror entries from:

```text
.claude/skills
```

3. Mirror entries from:

```text
.cursor/skills
```

For each mirror entry, classify it as one of the following:

### `linked`

A valid symlink pointing to an existing canonical skill.

Expected target:

```text
../../ai-specs/skills/<skill-name>
```

### `broken`

A symlink whose target cannot be resolved.

### `orphan`

A symlink pointing into the canonical namespace, but the target skill no longer exists in `ai-specs/skills`.

### `conflict`

A non-symlink file or directory with the same name as a canonical skill.

Do not overwrite it automatically.

### `external`

An entry that does not follow the canonical symlink policy.

Leave it unchanged and report it.

## Step 2: Compute Sync Plan

For each mirror target, compute:

### `to_add`

Canonical skills that exist under `ai-specs/skills` but are missing from the mirror target.

### `to_fix`

Broken canonical symlinks that should be removed and recreated.

### `to_remove`

Orphan canonical symlinks whose canonical source no longer exists.

### `to_skip`

Conflicts and external entries that must not be modified automatically.

## Step 3: Show the Plan Before Applying

Before changing anything, show a sync plan.

Use this format:

```markdown
## Skill Symlink Sync Plan

### Canonical Skills

- `<skill-name>`
- `<skill-name>`

### .claude/skills

To add:
- `<skill-name>`

To fix:
- `<skill-name>`

To remove:
- `<skill-name>`

Conflicts:
- `<skill-name>` — <reason>

External entries:
- `<entry>` — left unchanged

### .cursor/skills

To add:
- `<skill-name>`

To fix:
- `<skill-name>`

To remove:
- `<skill-name>`

Conflicts:
- `<skill-name>` — <reason>

External entries:
- `<entry>` — left unchanged
```

If the plan includes deleting links, fixing broken links, or resolving conflicts, ask for confirmation before applying.

If the plan only adds missing canonical symlinks and there are no conflicts, applying automatically is acceptable unless the user asked for dry-run mode.

## Step 4: Apply Sync Safely

Apply changes in this order.

### 4.1 Add Missing Links

Create missing mirror entries pointing to:

```text
../../ai-specs/skills/<skill-name>
```

### 4.2 Fix Broken Canonical Links

For broken links that were intended to point to the canonical namespace:

1. Remove the broken symlink.
2. Recreate the symlink to the correct canonical path.

Do not fix links that point to unknown or external locations without confirmation.

### 4.3 Remove Orphan Canonical Links

Remove only symlinks that:

* Are under `.claude/skills` or `.cursor/skills`
* Point into `../../ai-specs/skills/`
* Reference a canonical skill that no longer exists

Do not remove:

* Real directories
* Regular files
* External symlinks
* Unknown entries
* User-created local skill folders

## Step 5: Verify Integrity

After applying changes, verify:

* Every canonical skill exists in `.claude/skills` as a valid link, unless explicitly listed as a conflict.
* Every canonical skill exists in `.cursor/skills` as a valid link, unless explicitly listed as a conflict.
* No broken canonical symlinks remain.
* External entries were left unchanged.
* No real directories were overwritten.
* No non-canonical files were deleted.

Recommended checks:

```bash
ls -la ai-specs/skills
ls -la .claude/skills
ls -la .cursor/skills
```

On Windows PowerShell:

```powershell
Get-ChildItem ai-specs\skills
Get-ChildItem .claude\skills
Get-ChildItem .cursor\skills
```

## Step 6: Report Results

Return a concise sync report:

```markdown
## Skill Symlink Sync Report

Canonical skills: <count>

### .claude/skills

Added:
- `<skill-name>`

Fixed:
- `<skill-name>`

Removed:
- `<skill-name>`

Conflicts:
- `<skill-name>` — <reason>

External entries left unchanged:
- `<entry>`

### .cursor/skills

Added:
- `<skill-name>`

Fixed:
- `<skill-name>`

Removed:
- `<skill-name>`

Conflicts:
- `<skill-name>` — <reason>

External entries left unchanged:
- `<entry>`

### Result

- Broken canonical symlinks remaining: <none / list>
- Manual action required: <none / description>
```

## Add / Remove Scenarios

### Scenario A: New Skill Added in `ai-specs`

Expected behavior:

* Add missing link in `.claude/skills`
* Add missing link in `.cursor/skills`
* Verify both links resolve to the canonical folder

Example:

```text
ai-specs/skills/update-docs/SKILL.md
```

Should be exposed as:

```text
.claude/skills/update-docs -> ../../ai-specs/skills/update-docs
.cursor/skills/update-docs -> ../../ai-specs/skills/update-docs
```

### Scenario B: Skill Removed from `ai-specs`

Expected behavior:

* Remove orphan canonical symlink from `.claude/skills`
* Remove orphan canonical symlink from `.cursor/skills`
* Keep non-canonical directories untouched and report them

### Scenario C: Skill Renamed

Example:

```text
ai-specs/skills/old-name
```

renamed to:

```text
ai-specs/skills/new-name
```

Expected behavior:

* Remove orphan canonical links for `old-name`
* Add canonical links for `new-name`
* Report the rename in the sync summary

### Scenario D: Conflict with Real Directory

Example:

```text
.cursor/skills/commit
```

exists as a real directory, while:

```text
ai-specs/skills/commit
```

also exists.

Expected behavior:

* Do not overwrite `.cursor/skills/commit`
* Report it as a conflict
* Ask the user whether to replace it, back it up, or leave it unchanged

## Command Patterns

### Bash / Git Bash

List canonical skill directories:

```bash
find ai-specs/skills -maxdepth 2 -name SKILL.md -print
```

Inspect mirror entries:

```bash
ls -la .claude/skills
ls -la .cursor/skills
```

Add canonical link:

```bash
ln -s ../../ai-specs/skills/<skill-name> .claude/skills/<skill-name>
ln -s ../../ai-specs/skills/<skill-name> .cursor/skills/<skill-name>
```

Remove orphan canonical link:

```bash
rm .claude/skills/<skill-name>
rm .cursor/skills/<skill-name>
```

### PowerShell

List canonical skill directories:

```powershell
Get-ChildItem ai-specs\skills -Directory | Where-Object {
  Test-Path (Join-Path $_.FullName "SKILL.md")
}
```

Inspect mirror entries:

```powershell
Get-ChildItem .claude\skills -Force
Get-ChildItem .cursor\skills -Force
```

Add canonical symbolic link:

```powershell
New-Item -ItemType SymbolicLink -Path ".claude\skills\<skill-name>" -Target "..\..\ai-specs\skills\<skill-name>"
New-Item -ItemType SymbolicLink -Path ".cursor\skills\<skill-name>" -Target "..\..\ai-specs\skills\<skill-name>"
```

Remove orphan canonical link:

```powershell
Remove-Item ".claude\skills\<skill-name>"
Remove-Item ".cursor\skills\<skill-name>"
```

## External Tools

This skill should normally use only local filesystem and Git-aware path checks.

Do not use:

* Jira
* Sentry
* GitHub
* Context7
* Browser MCP
* Playwright MCP

GitHub is not needed because this skill synchronizes local skill exposure only.

Context7 is not needed because this skill relies on local repository structure.

## Guardrails

Never:

* Treat `ai-specs/skills` as non-canonical.
* Auto-delete real directories in mirror targets.
* Auto-overwrite files or directories.
* Delete external symlinks automatically.
* Leave broken canonical symlinks after sync.
* Silently skip conflicts.
* Modify `.claude` or `.cursor` files outside `skills`.
* Use Jira, Sentry, GitHub, or external MCPs for this task.
* Assume Linux/macOS symlink behavior on Windows.

Always:

* Analyze before changing.
* Apply minimal safe changes.
* Preserve non-canonical entries.
* Report conflicts.
* Ask before deleting or replacing anything ambiguous.
* Verify both `.claude/skills` and `.cursor/skills`.
* Provide a final sync report with blockers.
