---
name: /opsx-archive
id: opsx-archive
category: Workflow
description: Archive a completed change in the experimental workflow
---

Archive a completed change in the experimental workflow.

**Input**: Optionally specify a change name after `/opsx:archive` (e.g., `/opsx:archive add-auth`). If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **If no change name provided, prompt for selection**

   Run `openspec list --json` to get available changes. Use the **AskUserQuestion tool** to let the user select.

   Show only active changes (not already archived).
   Include the schema used for each change if available.

   **IMPORTANT**: Do NOT guess or auto-select a change. Always let the user choose.

2. **Check artifact completion status**

   Run `openspec status --change "<name>" --json` to check artifact completion.

   Parse the JSON to understand:
   - `schemaName`: The workflow being used
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context
   - `artifacts`: List of artifacts with their status (`done` or other)

   If status reports `actionContext.mode: "workspace-planning"`, explain that workspace archive is not supported in this slice and STOP. Do not move workspace changes into repo-local archives or edit linked repos.

   **If any artifacts are not `done`:**
   - Display warning listing incomplete artifacts
   - Prompt user for confirmation to continue
   - Proceed if user confirms

3. **Check task completion status**

   Read the tasks file (typically `tasks.md`) to check for incomplete tasks.

   Count tasks marked with `- [ ]` (incomplete) vs `- [x]` (complete).

   **If incomplete tasks found:**
   - Display warning showing count of incomplete tasks
   - Prompt user for confirmation to continue
   - Proceed if user confirms

   **If no tasks file exists:** Proceed without task-related warning.

3b. **Verify the change was delivered (PR merged)**

   Archiving is post-delivery cleanup. Confirm the change's Pull Request is merged before archiving:
   ```bash
   gh pr list --state merged --search "<change-name>"
   ```
   If no merged PR is found, warn that the change does not appear delivered and use **AskUserQuestion** to confirm before proceeding (the user may be archiving tooling/docs with no PR).

4. **Assess delta spec sync state**

   Use `artifactPaths.specs.existingOutputPaths` from status JSON to check for delta specs. If none exist, proceed without sync prompt.

   **If delta specs exist:**
   - Compare each delta spec with its corresponding main spec at `openspec/specs/<capability>/spec.md`
   - Determine what changes would be applied (adds, modifications, removals, renames)
   - Show a combined summary of what will be synced

   **Sync is MANDATORY when delta specs exist. Do NOT ask the user — always sync automatically.**

   Use Task tool (subagent_type: "general-purpose", prompt: "Use Skill tool to invoke openspec-sync-specs for change '<name>'. Delta spec analysis: <include the analyzed delta spec summary>"). If the sync task fails or reports errors, abort the archive immediately and report the sync error to the user — do NOT proceed to archive with unsynced specs.

5. **Perform the archive (validated CLI move)**

   Step 4 already synced the main specs, so archive with the native CLI using `--skip-specs` — this validates the change and moves it to `openspec/changes/archive/YYYY-MM-DD-<name>/`:
   ```bash
   openspec archive "<name>" --skip-specs -y
   ```
   If the target archive already exists the CLI fails — rename the existing archive or archive on a different date. Only fall back to a manual `mkdir`/`mv` if the CLI is unavailable.

6. **Display summary**

   Show archive completion summary including:
   - Change name
   - Schema that was used
   - Archive location
  - Spec sync status (synced / no delta specs)
   - Note about any warnings (incomplete artifacts/tasks)

7. **Commit the archive result and clean up the workspace (git close-out, MANDATORY)**

   The spec sync (Step 4) edited `openspec/specs/*` and the archive (Step 5) moved the change directory — both are uncommitted repo changes. Close the loop:
   - Stage and commit them (e.g. `chore(openspec): archive <name> and sync main specs`), excluding `.env`/secrets. If review is wanted, push and open a PR via `ai-specs/skills/commit/SKILL.md`.
   - Per `ai-specs/skills/using-git-worktrees/SKILL.md`, if the change used a Git worktree, OFFER to clean it up now — explicit, only after the PR is merged: verify no uncommitted/unpushed work, then `git worktree remove` and delete the merged branch. NEVER auto-remove a worktree with unsaved work.

**Output On Success**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** the archive path derived from `planningHome.changesDir`/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs

All artifacts complete. All tasks complete.
```

**Output On Success (No Delta Specs)**

```
## Archive Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** the archive path derived from `planningHome.changesDir`/YYYY-MM-DD-<name>/
**Specs:** No delta specs

All artifacts complete. All tasks complete.
```

**Output On Success With Warnings**

```
## Archive Complete (with warnings)

**Change:** <change-name>
**Schema:** <schema-name>
**Archived to:** the archive path derived from `planningHome.changesDir`/YYYY-MM-DD-<name>/
**Specs:** ✓ Synced to main specs (or "No delta specs")

**Warnings:**
- Archived with 2 incomplete artifacts
- Archived with 3 incomplete tasks

Review the archive if this was not intentional.
```

**Output On Error (Archive Exists)**

```
## Archive Failed

**Change:** <change-name>
**Target:** the archive path derived from `planningHome.changesDir`/YYYY-MM-DD-<name>/

Target archive directory already exists.

**Options:**
1. Rename the existing archive
2. Delete the existing archive if it's a duplicate
3. Wait until a different date to archive
```

**Guardrails**
- Always prompt for change selection if not provided
- Use artifact graph (openspec status --json) for completion checking
- Don't block archive on warnings - just inform and confirm
- Preserve .openspec.yaml when moving to archive (it moves with the directory)
- Show clear summary of what happened
- Archive is post-merge cleanup: verify the PR is merged before archiving
- Use the native `openspec archive <name> --skip-specs -y` for the validated move; keep the agent-driven `openspec-sync-specs` for the spec merge
- After archiving, commit the spec sync + the moved directory — never leave the working tree dirty
- Offer explicit Git worktree cleanup only after merge confirmation (per using-git-worktrees); never auto-remove
- If delta specs exist, always sync automatically — never ask the user, never skip sync
- Use the Skill tool to invoke `openspec-sync-specs` (agent-driven) whenever delta specs are present
