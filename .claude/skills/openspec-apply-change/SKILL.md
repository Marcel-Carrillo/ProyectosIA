---
name: openspec-apply-change
description: Implement tasks from an OpenSpec change. Use when the user wants to start implementing, continue implementation, or work through tasks.
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.4.1"
---

Implement tasks from an OpenSpec change.

**Input**: Optionally specify a change name. If omitted, check if it can be inferred from conversation context. If vague or ambiguous you MUST prompt for available changes.

**Steps**

1. **Select the change**

   If a name is provided, use it. Otherwise:
   - Infer from conversation context if the user mentioned a change
   - Auto-select if only one active change exists
   - If ambiguous, run `openspec list --json` to get available changes and use the **AskUserQuestion tool** to let the user select

   Always announce: "Using change: <name>" and how to override (e.g., `/opsx:apply <other>`).

2. **Check status to understand the schema**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to understand:
   - `schemaName`: The workflow being used (e.g., "spec-driven")
   - `planningHome`, `changeRoot`, and `actionContext`: planning scope and edit constraints
   - Which artifact contains the tasks (typically "tasks" for spec-driven, check status for others)

3. **Get apply instructions**

   ```bash
   openspec instructions apply --change "<name>" --json
   ```

   This returns:
   - `contextFiles`: artifact ID -> array of concrete file paths (varies by schema - could be proposal/specs/design/tasks or spec/tests/implementation/docs)
   - Progress (total, complete, remaining)
   - Task list with status
   - Dynamic instruction based on current state

   **Handle states:**
   - If `state: "blocked"` (missing artifacts): show message, suggest using openspec-continue-change
   - If `state: "all_done"`: congratulate, suggest archive
   - Otherwise: proceed to implementation

   **Workspace guard:** If status JSON reports `actionContext.mode: "workspace-planning"` and `allowedEditRoots` is empty, explain that full workspace apply is not supported in this slice. Treat linked repos and folders as read-only context, ask the user to select an affected area through an explicit implementation workflow, and STOP before editing files.

4. **Read context files**

   Read every file path listed under `contextFiles` from the apply instructions output.
   The files depend on the schema being used:
   - **spec-driven**: proposal, specs, design, tasks
   - Other schemas: follow the contextFiles from CLI output

   Also read (selective context loading per `docs/base-standards.md`):
   - `docs/base-standards.md` (always) and `docs/openspec-tasks-mandatory-steps.md`
   - Backend scope: `docs/backend-standards.md`, `docs/data-model.md`, `docs/api-spec.yml`
   - Frontend scope: `docs/frontend-standards.md`, `docs/api-spec.yml`

4b. **Isolate the workspace, then plan each layer with its agent (MANDATORY — before editing any file)**

   a. **Workspace isolation (Step 0).** Apply `ai-specs/skills/using-git-worktrees/SKILL.md`: ensure you are on a feature branch / worktree (default `feature/<change-name>`), never on `master`/`main` or an unrelated branch. If `tasks.md` defines Step 0, execute it; otherwise create the branch/worktree now, before any code change.

   b. **Per-layer planning subagents — they plan, the parent builds (complements `design.md`, does not replace it).** Decide whether the change touches backend, frontend, or both (from `design.md`, `specs`, `tasks.md`). For each affected layer: write `.claude/sessions/context_session_<change-name>.md` with the change context (links to proposal/design/specs/tasks), then spawn the matching planning agent and wait:
      - Backend → `Agent(subagent_type: "general-purpose", model: "sonnet", prompt: "Read and apply ai-specs/agents/backend-developer.md in full. Feature: <change-name>. Read .claude/sessions/context_session_<change-name>.md plus the change's design.md / specs / tasks.md, then save a per-file implementation plan to .claude/doc/<change-name>/backend.md.")`
      - Frontend → same with `ai-specs/agents/frontend-developer.md` → `.claude/doc/<change-name>/frontend.md`
      Then read `.claude/doc/<change-name>/{backend,frontend}.md` and implement from those file-level plans together with `design.md`. The agents ONLY plan; you (the parent) do the building and run tests/servers. For small single-file or non-code changes you may skip the subagent and implement directly — state why.

5. **Show current progress**

   Display:
   - Schema being used
   - Progress: "N/M tasks complete"
   - Remaining tasks overview
   - Dynamic instruction from CLI

6. **Implement tasks (loop until done or blocked)**

   For each pending task:
   - Show which task is being worked on
   - Make the code changes required, implementing from the `.claude/doc/<change-name>/{backend,frontend}.md` plan plus `design.md`
   - Keep changes minimal and focused
   - **Execute the mandatory verification yourself** (per `docs/openspec-tasks-mandatory-steps.md`): run unit tests + verify DB state; run curl for backend endpoints; run Playwright E2E for frontend workflows; write reports under `openspec/changes/<change-name>/reports/`. NEVER delegate testing to the user.
   - For the "Update Technical Documentation" task, apply `ai-specs/skills/update-docs/SKILL.md` to identify and update the affected docs (`docs/data-model.md`, `docs/api-spec.yml`, backend/frontend standards) — do not update docs ad-hoc.
   - **Update `tasks.md` on disk immediately** after each sub-task: change `- [ ]` → `- [x]` in `openspec/changes/<name>/tasks.md` as soon as that sub-task is done. Do this on the fly every step; never batch at session end and never wait for the user to ask.
   - Mark verification steps complete **only with evidence** (tests pass, DB restored for CREATE/UPDATE/DELETE, report created)
   - Continue to next task

   **Pause if:**
   - Task is unclear → ask for clarification
   - Implementation reveals a design issue → suggest updating artifacts
   - Error or blocker encountered → report and wait for guidance
   - User interrupts

7. **On completion or pause, show status**

   Display:
   - Tasks completed this session
   - Overall progress: "N/M tasks complete"
   - If all done: suggest archive
   - If paused: explain why and wait for guidance

7b. **Offer an adversarial review before committing (recommended)**

   When all tasks are complete and verified, offer to run a red-team pass: read and apply `ai-specs/skills/adversarial-review/SKILL.md` for this change (ideally from a fresh subagent/session for independence). Do NOT commit if it surfaces blockers or majors — fix them first. Skip only if the user declines.

8. **Commit and open the Pull Request (MANDATORY — last step)**

   When all tasks are complete, load and apply `ai-specs/skills/commit/SKILL.md`: stage the change (exclude `.env`, `node_modules`, build artifacts), commit with a Conventional Commit message, push the feature branch, and run `gh pr create`. Report the PR URL. A change is not complete without a PR.

**Output During Implementation**

```
## Implementing: <change-name> (schema: <schema-name>)

Working on task 3/7: <task description>
[...implementation happening...]
✓ Task complete

Working on task 4/7: <task description>
[...implementation happening...]
✓ Task complete
```

**Output On Completion**

```
## Implementation Complete

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 7/7 tasks complete ✓

### Completed This Session
- [x] Task 1
- [x] Task 2
...

All tasks complete! Ready to archive this change.
```

**Output On Pause (Issue Encountered)**

```
## Implementation Paused

**Change:** <change-name>
**Schema:** <schema-name>
**Progress:** 4/7 tasks complete

### Issue Encountered
<description of the issue>

**Options:**
1. <option 1>
2. <option 2>
3. Other approach

What would you like to do?
```

**Guardrails**
- Keep going through tasks until done or blocked
- Always read context files before starting (from the apply instructions output)
- If task is ambiguous, pause and ask before implementing
- If implementation reveals issues, pause and suggest artifact updates
- Keep code changes minimal and scoped to each task
- Update `tasks.md` checkbox immediately after completing each sub-task (on the fly; user must not need to ask)
- Pause on errors, blockers, or unclear requirements - don't guess
- Use contextFiles from CLI output, don't assume specific file names
- Isolate on a feature branch / worktree (Step 0) BEFORE editing any file; never implement on `master`/`main`
- Plan backend/frontend work with `ai-specs/agents/{backend,frontend}-developer.md` (plan saved to `.claude/doc/<change-name>/`), then implement from the plan — agents plan, the parent builds
- Execute all mandatory tests yourself (unit, curl, E2E) and create reports; mark tasks `[x]` only with evidence
- Finish with Commit + PR via `ai-specs/skills/commit/SKILL.md`

**Fluid Workflow Integration**

This skill supports the "actions on a change" model:

- **Can be invoked anytime**: Before all artifacts are done (if tasks exist), after partial implementation, interleaved with other actions
- **Allows artifact updates**: If implementation reveals design issues, suggest updating artifacts - not phase-locked, work fluidly
