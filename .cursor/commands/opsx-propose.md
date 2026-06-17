---
name: /opsx-propose
id: opsx-propose
category: Workflow
description: Propose a new change - create it and generate all artifacts in one step
---

Propose a new change - create the change and generate all artifacts in one step.

I'll create a change with artifacts:
- proposal.md (what & why)
- design.md (how)
- tasks.md (implementation steps)

When ready to implement, switch to Sonnet 4.6 and run /opsx:apply

---

**Input**: The argument after `/opsx:propose` is the change name (kebab-case), OR a description of what the user wants to build.

**Steps**

1. **If no input provided, ask what they want to build**

   Use the **AskUserQuestion tool** (open-ended, no preset options) to ask:
   > "What change do you want to work on? Describe what you want to build or fix."

   From their description, derive a kebab-case name (e.g., "add user authentication" → `add-user-auth`).

   **IMPORTANT**: Do NOT proceed without understanding what the user wants to build.

2. **Enrich the request using an Opus 4.8 subagent (MANDATORY — fully automated)**

   Use the **Agent tool** to spawn a subagent on Opus 4.8 that runs the full enrich-us workflow:

   ```
   Agent(
     subagent_type: "general-purpose",
     model: "opus",
     prompt: "Read and apply ai-specs/skills/enrich-us/SKILL.md in full.
              The user's request to enrich (direct input mode — no Jira needed): <user's full description>
              Output the complete ## Functional Analysis, ## Original, and ## Enhanced sections exactly as the skill specifies."
   )
   ```

   Wait for the subagent to return. Its response contains the enrichment output.

   **Display the subagent's full output in chat** (## Functional Analysis, ## Original, ## Enhanced) before continuing.

   **Do NOT ask for confirmation after enrichment.** Use `## Functional Analysis` + `## Enhanced` as the definitive input for all subsequent artifacts (proposal, design, tasks).

3. **Create the change directory**
   ```bash
   openspec new change "<name>"
   ```
   This creates a scaffolded change in the planning home resolved by the CLI with `.openspec.yaml`.

4. **Get the artifact build order**
   ```bash
   openspec status --change "<name>" --json
   ```
   Parse the JSON to get:
   - `applyRequires`: array of artifact IDs needed before implementation (e.g., `["tasks"]`)
   - `artifacts`: list of all artifacts with their status and dependencies
   - `planningHome`, `changeRoot`, `artifactPaths`, and `actionContext`: path and scope context. Use these instead of assuming repo-local paths.

5. **Create artifacts in sequence until apply-ready**

   Use the **TodoWrite tool** to track progress through the artifacts.

   Loop through artifacts in dependency order (artifacts with no pending dependencies first):

   a. **For each artifact that is `ready` (dependencies satisfied)**:
      - Get instructions:
        ```bash
        openspec instructions <artifact-id> --change "<name>" --json
        ```
      - The instructions JSON includes:
        - `context`: Project background (constraints for you - do NOT include in output)
        - `rules`: Artifact-specific rules (constraints for you - do NOT include in output)
        - `template`: The structure to use for your output file
        - `instruction`: Schema-specific guidance for this artifact type
        - `resolvedOutputPath`: Resolved path or pattern to write the artifact
        - `dependencies`: Completed artifacts to read for context
      - Read any completed dependency files for context
      - **Before writing the first artifact**, read `docs/base-standards.md` and apply the "Global authoring rules" delivered in the `context` field — they govern EVERY artifact. Honor both `rules` AND `context` from the instructions as mandatory constraints (not just the `template`).
      - **When the artifact is `tasks`**: first read `docs/openspec-tasks-mandatory-steps.md`, then expand the generic template into the project's MANDATORY structure — Step 0 "Create Feature Branch" (apply `ai-specs/skills/using-git-worktrees/SKILL.md`) as the FIRST step, then the implementation groups, then the mandatory steps: Review unit tests; Run unit tests + verify DB + report; Manual curl testing (AGENT MUST EXECUTE) for backend endpoints + report; E2E Playwright for frontend workflows + report; Update technical documentation; Commit + create PR as the LAST step. Reports go under `openspec/changes/<name>/reports/`.
      - Create the artifact file using `template` as the structure and write it to `resolvedOutputPath`
      - Apply `context` and `rules` as constraints - but do NOT copy them into the file
      - Show brief progress: "Created <artifact-id>"

   b. **Continue until all `applyRequires` artifacts are complete**
      - After creating each artifact, re-run `openspec status --change "<name>" --json`
      - Check if every artifact ID in `applyRequires` has `status: "done"` in the artifacts array
      - Stop when all `applyRequires` artifacts are done

   c. **If an artifact requires user input** (unclear context):
      - Use **AskUserQuestion tool** to clarify
      - Then continue with creation

6. **Show final status**
   ```bash
   openspec status --change "<name>"
   ```

**Output**

After completing all artifacts, summarize:
- Change name and location
- List of artifacts created with brief descriptions
- What's ready: "All artifacts created! Ready for implementation."
- Prompt: "Run `/opsx:apply` to start implementing."

**Artifact Creation Guidelines**

- Follow the `instruction` field from `openspec instructions` for each artifact type
- The schema defines what each artifact should contain - follow it
- Read dependency artifacts for context before creating new ones
- Use `template` as the structure for your output file - fill in its sections
- **IMPORTANT**: `context` and `rules` are constraints for YOU, not content for the file
  - Do NOT copy `<context>`, `<rules>`, `<project_context>` blocks into the artifact
  - These guide what you write, but should never appear in the output

**Guardrails**
- Create ALL artifacts needed for implementation (as defined by schema's `apply.requires`)
- Always read dependency artifacts before creating a new one
- If context is critically unclear, ask the user - but prefer making reasonable decisions to keep momentum
- If a change with that name already exists, ask if user wants to continue it or create a new one
- Verify each artifact file exists after writing before proceeding to next
- Before writing artifacts, read `docs/base-standards.md` and apply the global rules delivered via the instructions `context`
- `tasks.md` MUST follow `docs/openspec-tasks-mandatory-steps.md`: Step 0 (feature branch / worktree) first and Commit + PR last, including curl, E2E, and report steps. Never emit a bare generic task list
