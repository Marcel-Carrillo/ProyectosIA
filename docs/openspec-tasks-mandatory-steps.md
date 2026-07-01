---

description: Enforce mandatory steps from openspec/config.yaml when creating tasks.md artifacts and ensure agent executes all manual tests
alwaysApply: true
-----------------

# OpenSpec Tasks: Mandatory Steps Enforcement

---

## REGLA CRÍTICA — MARCADO DE TAREAS EN TIEMPO REAL (LEE ESTO PRIMERO)

**Esta regla se aplica SIEMPRE, sin excepción, desde el primer sub-task hasta el último.**

Cada vez que terminas una sub-tarea, debes editar `tasks.md` en disco **en ese mismo momento** y cambiar `- [ ]` por `- [x]`. No al final de la sesión, no antes de archivar, no en bloque al terminar una sección: **INMEDIATAMENTE**, una a una, a medida que se completan.

**Cómo aplicarlo:**

- Implementas tarea 1.1 → editas `tasks.md` → marcas `[x]` → continúas con 1.2.
- Implementas tarea 1.2 → editas `tasks.md` → marcas `[x]` → continúas con 1.3.
- Si la sesión se interrumpe, el estado de `tasks.md` en disco debe reflejar exactamente lo completado hasta ese punto.

**Por qué es obligatorio:**

- El historial de la sesión puede perderse o comprimirse entre interrupciones.
- Al archivar, decenas de tareas aparecen sin marcar aunque el trabajo esté hecho, obligando a revisar todo manualmente.
- El usuario ha tenido que corregir esto repetidamente. No vuelvas a requerir esta corrección.

**Regla por tipo de tarea:**

- **Tareas de implementación** (código, tests, CSS, componentes, docs): marcar `[x]` en cuanto ese sub-task está terminado y verificado localmente.
- **Tareas de verificación** (unit tests, curl, E2E, commit/PR): marcar `[x]` solo después de cumplir los criterios del step correspondiente (tests pasados, DB restaurada, reporte creado). Ver secciones 3, 7 y 8 de este documento.

---

When creating or updating `tasks.md` artifacts in OpenSpec changes, you MUST:

## 1. Read openspec/config.yaml First

**BEFORE** creating or updating any `tasks.md` file, you MUST read `openspec/config.yaml` to understand:

* Backend and frontend-specific mandatory steps
* Branch naming conventions
* Task structure requirements
* Testing and documentation requirements

## 2. Mandatory Steps

All implementation tasks MUST include these steps in the correct order:

### Step 0: Create Feature Branch (MUST BE FIRST)

* **Location**: Must be the very first step (Step 0)
* **Branch source**: Feature branches MUST branch from `develop`, never from `master`/`main`. If the current checkout is on `master`/`main`, fetch and check out `develop` first (`git fetch origin && git checkout develop && git pull`), then branch from it.
* **Branch naming**: `feature/[ticket-id]` or `feature/[change-name]`
* **Action**: Create and switch to feature branch before any code changes
* **Isolation integration**: Before Step 0 execution, apply `ai-specs/skills/using-git-worktrees/SKILL.md` to decide whether to work in the current checkout or a dedicated Git worktree. Step 0 still applies to the branch inside that chosen workspace.
* **PR target**: The Pull Request created in the final step (below) MUST target `develop`, never `master`/`main`. `master` only receives `develop` through a separate, deliberate release/promotion step — never directly from a feature branch.

### Mandatory Steps (Must Be Included):

* **Step N**: Review and Update Existing Unit Tests (MANDATORY)
* **Step N+1**: Run Unit Tests and Verify Database State (MANDATORY)
* **Step N+2**: Manual Endpoint Testing with curl (MANDATORY) - **AGENT MUST EXECUTE**
* **Step N+3**: E2E Testing with Playwright MCP (MANDATORY if applicable) - **AGENT MUST EXECUTE**
* **Step N+4**: Update Technical Documentation (MANDATORY)
* **Step N+5**: Commit and Create Pull Request (MANDATORY - LAST STEP)

## 3. Manual Testing Requirements - CRITICAL: Agent Must Execute

**IMPORTANT**: The coding agent (AI) MUST perform all manual testing steps itself. **NEVER delegate testing to the user**. These tests must be executed by the agent to mark tasks as completed in `tasks.md`.

### Step N+1: Run Unit Tests and Verify Database State (MANDATORY)

**Agent Responsibility**: The coding agent MUST execute unit tests, validate database integrity before and after execution, and produce a test report artifact in the change spec folder. This is NOT optional and cannot be delegated to the user.

**Implementation Steps** (Agent must perform):

1. **Prepare Test Environment**:

   * Ensure required services are available, including database, cache, and dependencies.
   * Capture pre-test database state relevant to the change, such as counts, key records, checksums, or snapshots.
   * Document the exact test command(s) that will be executed.

2. **Run Targeted Unit Tests First**:

   * Execute focused tests for the modified module(s) and related behavior.
   * Confirm failures are resolved and no new regressions appear in targeted scope.
   * Capture command output summary, including passed, failed, and skipped tests.

3. **Run Broader Unit Test Suite**:

   * Execute the project/unit suite required by `openspec/config.yaml`, or a justified subset if configured.
   * Record total test counts, failures, runtime, and any flaky behavior observed.

4. **Verify Post-Test Database State**:

   * Re-check the same database indicators captured before tests.
   * Confirm no unintended mutations remain after tests complete.
   * If any mutation occurred, restore state and document the restoration.

5. **Create Unit Test Verification Report in Spec Folder**:

   * Save report under the current change folder in `specs/<change-name>/reports/`.
   * Use this filename pattern: `YYYY-MM-DD-step-N+1-unit-test-and-db-verification.md`.
   * Include executed commands, summarized results, database pre/post comparison, and cleanup actions.

6. **Mark Task as Completed**:

   * Only after unit tests pass, or approved exceptions are documented.
   * Only after database state is verified or restored.
   * Only after the report file is created.

**Report Template** (store in `specs/<change-name>/reports/`):

```markdown
# Step N+1 Report - Unit Tests and Database Verification

- Date: YYYY-MM-DD
- Change: <change-name>
- Agent: <agent-name>

## Commands Executed

- `<command 1>`
- `<command 2>`

## Unit Test Results

- Targeted tests: X passed, Y failed, Z skipped
- Full/required suite: X passed, Y failed, Z skipped
- Runtime: <duration>
- Notes: <flaky tests, retries, exceptions>

## Database State Verification

- Pre-test baseline:
  - <metric/table/check>: <value>
- Post-test validation:
  - <metric/table/check>: <value>
- State restored: Yes/No
- Restoration actions (if any): <actions>

## Outcome

- Step N+1 status: PASS/FAIL
- Blocking issues: <none or list>
```

**Dependencies**:

* Test runner and project test dependencies installed.
* Database access for state verification/restoration.
* Permission to create report files in `specs/<change-name>/reports/`.

**Notes**:

* **The agent MUST execute tests itself** - never ask the user to run tests.
* This step is mandatory even when code changes look small.
* Report naming must follow the required pattern for traceability.
* **Task completion in tasks.md can only be marked after report creation.**

### Step N+2: Manual Endpoint Testing with curl (MANDATORY)

**Agent Responsibility**: The coding agent MUST execute all curl commands and verify responses. This is NOT optional and cannot be delegated to the user.

**Implementation Steps** (Agent must perform):

1. **Prepare Test Environment**:

   * Ensure the backend server is running, starting it if needed.
   * Verify database connection is active.
   * Note the current database state if testing CREATE, UPDATE, or DELETE endpoints.

2. **Test GET Endpoints** (if any):

   * Create curl command to test GET endpoint.
   * Execute curl command: `curl -X GET [endpoint-url] [headers]`.
   * Verify response status code, such as 200 or 404.
   * Verify response body structure and content.
   * Document the curl command and response in the task completion report.

3. **Test POST Endpoints** (CREATE operations):

   * Create curl command with request body: `curl -X POST [endpoint-url] -H "Content-Type: application/json" -d '[json-body]'`.
   * Execute curl command and capture response.
   * Verify response status code, such as 201, 400, or 422.
   * Verify response body contains created resource.
   * **Restore Database State**: After testing, delete the created record to restore database to original state.
   * Document the curl command, response, and cleanup action.

4. **Test PUT/PATCH Endpoints** (UPDATE operations):

   * Create curl command with updated data: `curl -X PUT [endpoint-url] -H "Content-Type: application/json" -d '[json-body]'`.
   * Execute curl command and capture response.
   * Verify response status code, such as 200, 404, or 400.
   * Verify response body contains updated resource.
   * **Restore Database State**: After testing, revert the updated record to its original values to restore database state.
   * Document the curl command, response, and cleanup action.

5. **Test DELETE Endpoints**:

   * Create curl command: `curl -X DELETE [endpoint-url]`.
   * Execute curl command and capture response.
   * Verify response status code, such as 200, 204, or 404.
   * Verify deletion was successful.
   * **Restore Database State**: After testing, recreate the deleted record with original values to restore database state.
   * Document the curl command, response, and cleanup action.

6. **Test Error Cases**:

   * Test with invalid data.
   * Test with non-existent resources.
   * Test with unauthorized access if applicable.
   * Verify error response format matches API specification.

7. **Create Manual Endpoint Test Report**:

   * Save report under the current change folder in `specs/<change-name>/reports/`.
   * Use this filename pattern: `YYYY-MM-DD-step-N+2-curl-endpoint-testing.md`.
   * Include executed curl commands, response summaries, status codes, assertions, and cleanup actions.

8. **Mark Task as Completed**:

   * Only after all curl tests pass.
   * Only after database state is restored.
   * Only after the report file is created.

**Dependencies**:

* Backend server running, started by the agent if needed.
* Database access for state restoration.
* curl command-line tool.

**Notes**:

* This step is MANDATORY for all new or modified backend endpoints.
* **The agent MUST execute all curl commands itself** - never ask the user to run tests.
* All CREATE, UPDATE, and DELETE operations must restore database to original state after testing.
* Document all curl commands and responses for future reference in a report in the spec folder with proper naming.
* Verify that database state matches pre-test state after cleanup.
* Do not skip manual testing even if unit tests pass.
* **Task completion in tasks.md can only be marked after successful execution of all curl tests.**

### Step N+3: E2E Testing with Playwright MCP (MANDATORY if applicable)

**Agent Responsibility**: The coding agent MUST execute all E2E tests using Playwright MCP tools. This is NOT optional and cannot be delegated to the user.

**When This Applies**:

* Frontend changes that affect user workflows.
* Integration between frontend and backend endpoints.
* User-facing features that require browser interaction.

**Implementation Steps** (Agent must perform):

1. **Prepare Test Environment**:

   * Ensure both frontend and backend servers are running, starting them if needed.
   * Verify database is in a known state.
   * Check available Playwright MCP tools using MCP file system.

2. **Navigate to Application**:

   * Use Playwright MCP `browser_navigate` to open the application URL.
   * Wait for page to load completely.
   * Take a snapshot to verify initial state.

3. **Execute User Workflows**:

   * Use Playwright MCP tools to interact with the UI:

     * `browser_click` for button clicks and navigation.
     * `browser_type` or `browser_fill` for form inputs.
     * `browser_snapshot` to verify state changes.
     * `browser_wait` for async operations.
   * Test the complete user workflow from start to finish.
   * Verify expected outcomes at each step.

4. **Test Error Scenarios**:

   * Test form validation errors.
   * Test error messages display correctly.
   * Test error recovery flows.

5. **Verify Data Persistence**:

   * After creating or updating data through UI, verify it persists correctly.
   * Check database state matches UI state.
   * Verify data appears correctly in lists and details views.

6. **Restore Test Environment**:

   * Clean up any test data created during E2E tests.
   * Restore database to original state.
   * Close browser sessions.

7. **Create E2E Test Report**:

   * Save report under the current change folder in `specs/<change-name>/reports/`.
   * Use this filename pattern: `YYYY-MM-DD-step-N+3-e2e-testing.md`.
   * Include executed workflows, browser interactions, assertions, screenshots or snapshots if available, and cleanup actions.

8. **Mark Task as Completed**:

   * Only after all E2E tests pass.
   * Only after environment and database state are restored.
   * Only after the report file is created.

**Dependencies**:

* Frontend server running, started by the agent if needed.
* Backend server running, started by the agent if needed.
* Playwright MCP tools available.
* Database access for verification and cleanup.

**Notes**:

* **The agent MUST execute all E2E tests itself** - never ask the user to run tests.
* Use incremental waits of 1-3 seconds with snapshot checks rather than long waits.
* Always restore database state after tests that modify data.
* Document test scenarios and outcomes in a report in the spec folder with proper naming.
* **Task completion in tasks.md can only be marked after successful execution of all E2E tests.**

## 4. Verification Checklist

Before finalizing any `tasks.md` file, verify:

* [ ] Step 0 (Create Feature Branch) is the FIRST step.
* [ ] All mandatory steps from `openspec/config.yaml` are included.
* [ ] Steps are numbered sequentially.
* [ ] Mandatory steps are clearly marked with `(MANDATORY)` label.
* [ ] Branch naming follows the convention from `openspec/config.yaml`.
* [ ] Step N+1 includes report path and naming convention in `specs/<change-name>/reports/`.
* [ ] Step N+2 includes report path and naming convention in `specs/<change-name>/reports/`.
* [ ] Step N+3 includes report path and naming convention in `specs/<change-name>/reports/` if frontend changes are involved.
* [ ] Manual testing steps explicitly state `AGENT MUST EXECUTE`.
* [ ] Tasks include database state restoration steps.
* [ ] E2E testing step is included if frontend changes are involved.
* [ ] Technical documentation update step is included.
* [ ] Ecommerce business rules are reflected when relevant.

## 5. When This Applies

This rule applies when:

* Creating `tasks.md` via `/opsx:ff` or `openspec-ff-change` skill.
* Creating `tasks.md` via `/opsx:continue` or `openspec-continue-change` skill.
* Updating existing `tasks.md` files.
* Any task creation that involves backend changes.
* Any task creation that involves frontend changes.
* Implementing tasks from `tasks.md` via `/opsx:apply` or `openspec-apply-change` skill.
* Creating or updating ecommerce functionality such as products, categories, suppliers, customer orders, supplier orders, shipments, returns, or refunds.

## 6. Example Structure

```markdown
## 0. Setup: Create Feature Branch (MANDATORY - FIRST STEP)

- [ ] 0.1 Create feature branch `feature/product-catalog-backend` from `develop` branch
- [ ] 0.2 Verify branch creation and current branch status

## 1. Backend: Validator Tests (TDD)

...

## 2. Backend: Product Domain Model

...

## 3. Backend: Product Repository

...

## 4. Backend: Product Service

...

## 5. Backend: Product Controller and Routes

...

## 8. Backend: Review and Update Existing Unit Tests (MANDATORY)

...

## 9. Backend: Run Unit Tests and Verify Database State (MANDATORY)

- [ ] 9.1 Capture pre-test database baseline for impacted entities.
- [ ] 9.2 Run targeted unit tests for changed modules.
- [ ] 9.3 Run required broader unit test suite from config.
- [ ] 9.4 Verify post-test database state and restore if needed.
- [ ] 9.5 Create report `specs/<change-name>/reports/YYYY-MM-DD-step-N+1-unit-test-and-db-verification.md`.
- [ ] 9.6 Mark step complete only after tests pass and report exists.

## 10. Backend: Manual Endpoint Testing with curl (MANDATORY - AGENT MUST EXECUTE)

- [ ] 10.1 Ensure backend server is running.
- [ ] 10.2 Test GET endpoints with curl and verify responses.
- [ ] 10.3 Test POST endpoints with curl, verify creation, then restore database state.
- [ ] 10.4 Test PUT/PATCH endpoints with curl, verify updates, then restore database state.
- [ ] 10.5 Test DELETE endpoints with curl, verify deletion, then restore database state.
- [ ] 10.6 Test error cases including validation errors and 404 cases.
- [ ] 10.7 Document all curl commands and responses.
- [ ] 10.8 Verify database state matches pre-test state.
- [ ] 10.9 Create report `specs/<change-name>/reports/YYYY-MM-DD-step-N+2-curl-endpoint-testing.md`.

## 11. Frontend: E2E Testing with Playwright MCP (MANDATORY if applicable - AGENT MUST EXECUTE)

- [ ] 11.1 Ensure frontend and backend servers are running.
- [ ] 11.2 Navigate to application using Playwright MCP `browser_navigate`.
- [ ] 11.3 Execute complete user workflow using Playwright MCP tools.
- [ ] 11.4 Test error scenarios and validation.
- [ ] 11.5 Verify data persistence and UI state.
- [ ] 11.6 Restore test environment and database state.
- [ ] 11.7 Document test scenarios and outcomes.
- [ ] 11.8 Create report `specs/<change-name>/reports/YYYY-MM-DD-step-N+3-e2e-testing.md`.

## 16. Update Technical Documentation (MANDATORY)

- [ ] 16.1 Review changes against `docs/data-model.md`.
- [ ] 16.2 Review changes against `docs/api-spec.yml`.
- [ ] 16.3 Review changes against `docs/backend-standards.md`.
- [ ] 16.4 Review changes against `docs/frontend-standards.md` if frontend changes are involved.
- [ ] 16.5 Update affected documentation files.
- [ ] 16.6 Document what was updated and why.
```

## 7. Agent Execution Requirements

**CRITICAL**: When implementing tasks from `tasks.md` through `openspec-apply-change` skill or `/opsx:apply` command, the coding agent MUST:

1. **Execute All Manual Tests**

   Never ask the user to run curl commands or E2E tests. The agent must:

   * Start servers if needed, including backend and frontend.
   * Execute all curl commands for endpoint testing.
   * Execute all E2E tests using Playwright MCP tools when applicable.
   * Verify all responses and outcomes.
   * Restore database state after tests.

2. **Mark Tasks as Completed (incrementally, in `tasks.md` on disk)**

   The agent MUST update `openspec/changes/<change-name>/tasks.md` **immediately** after
   each sub-task is finished — on the fly, without the user having to request it.
   Do not defer checkbox updates to the end of a session or only summarize progress
   in chat.

   * **Implementation sub-tasks** (code, CSS, components, docs edits): mark `- [x]`
     as soon as that sub-task is done and verified locally (e.g. lint/tsc for that
     scope if applicable).
   * **Mandatory verification sub-tasks** (unit tests, curl, E2E, commit/PR): mark
     `- [x]` only AFTER the criteria below are met for that step.

   Tasks can ONLY be marked as completed (`[x]`) for verification steps AFTER:

   * The agent has successfully executed all required tests for that step.
   * All test results have been verified.
   * Database state has been restored for CREATE, UPDATE, and DELETE operations.
   * All test outcomes have been documented.
   * Required report files have been created (when the step requires a report).

3. **Never Delegate Testing**

   The agent must never:

   * Ask the user to run curl commands.
   * Ask the user to test endpoints manually.
   * Ask the user to run E2E tests.
   * Mark tasks as completed without executing tests.
   * Skip manual testing steps.

4. **Document Test Execution**

   The agent must document:

   * All curl commands executed.
   * All responses received.
   * All E2E test scenarios executed.
   * Database state restoration actions.
   * Any issues encountered and resolutions.

## 8. Step N+5: Commit and Create Pull Request (MANDATORY — LAST STEP)

This step must always be the last implementation step, after documentation has been updated and all tests have passed.

**Agent Responsibility**: The coding agent MUST execute the commit and PR creation using the `commit` skill. This is NOT optional and cannot be delegated to the user.

**When to include this step**: Always — for every OpenSpec change that modifies code, tests, or documentation.

**Implementation Steps** (Agent must perform):

1. **Load and apply the `commit` skill** from `ai-specs/skills/commit/SKILL.md` before executing any Git commands.

2. **Verify pre-commit readiness**:

   * All tasks in `tasks.md` are marked `[x]`.
   * Required test reports exist under `openspec/changes/<change-name>/reports/`.
   * Documentation updates are complete.
   * No `.env`, secrets, `node_modules`, or build artifacts are staged.

3. **Stage all relevant changes**:

   * Use `git add` for all files belonging to this change (code, tests, docs, OpenSpec artifacts).
   * Exclude: `.env`, `node_modules/`, `dist/`, `coverage/`, secrets, temporary files.

4. **Create commit** following Conventional Commit format:

   ```text
   feat(<scope>): <imperative summary>

   - <relevant change 1>
   - <relevant change 2>
   - OpenSpec change: <change-name>
   - Tests: <unit / curl / E2E — passed or not applicable>
   ```

5. **Push branch** to remote origin:

   ```bash
   git push -u origin <branch-name>
   ```

6. **Create Pull Request** using GitHub CLI, targeting `develop` (never `master`/`main`):

   ```bash
   gh pr create --base develop --title "<type>(<scope>): <summary>" --body "..."
   ```

   Even though the repository's default branch is `develop`, always pass `--base develop` explicitly — do not rely on the default silently being correct.

   PR body must include:
   * Summary of changes
   * OpenSpec change name
   * Verification status (unit tests, curl, E2E, adversarial review)
   * Notes or known limitations

7. **Report PR URL** in the chat so the user can review it.

**Task structure** in `tasks.md`:

```markdown
## N+5. Commit and Create Pull Request (MANDATORY)

- [ ] N+5.1 Load and apply ai-specs/skills/commit/SKILL.md
- [ ] N+5.2 Verify all tasks complete and reports exist
- [ ] N+5.3 Stage all relevant files (exclude .env, node_modules, dist, coverage)
- [ ] N+5.4 Create commit with Conventional Commit message
- [ ] N+5.5 Push branch to remote origin
- [ ] N+5.6 Create Pull Request with gh pr create and report URL
```

**Guardrails**:

* Do not commit `.env` or secrets under any circumstance.
* Do not commit `node_modules/`, `dist/`, or `coverage/`.
* Do not push to `master` or `develop` directly — always use the feature branch.
* Every feature PR targets `develop`, never `master`/`main`. `master` only receives changes via a separate, deliberate `develop` → `master` release promotion — never a direct feature branch merge.
* Do not force push without explicit user approval.
* Do not skip this step — the change is not complete until the PR exists.

## 9. Ecommerce-Specific Task Requirements

When creating or implementing tasks for this ecommerce project, ensure relevant tasks consider:

* Products and product variants as separate concepts.
* Customer orders and supplier orders as separate concepts.
* Supplier costs and internal supplier data must not be exposed through customer-facing APIs.
* Customer-facing order status and internal fulfillment status must be handled separately.
* A customer order may generate one or more supplier orders.
* Supplier fulfillment is the initial model, but the design must allow future internal stock or hybrid fulfillment.
* Documentation must be updated when data model, API, backend logic, frontend workflows, or business rules change.

## Failure to Follow

If you create tasks without following these mandatory steps, the user will need to manually fix the `tasks.md` file. Always read `openspec/config.yaml` first and ensure all mandatory steps are included.

**If you implement tasks without executing manual tests yourself, you are violating this rule. The agent must execute all tests to mark tasks as completed.**

**If you complete all tasks but do not create a commit and Pull Request, the change is incomplete. The commit + PR step is mandatory for every OpenSpec change.**
