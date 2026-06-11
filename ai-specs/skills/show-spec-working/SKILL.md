---

name: show-spec-working
description: Demonstrate how an OpenSpec change, feature, endpoint, or frontend flow works using the available local project context and safe verification steps.
author: Marcel Carrillo
version: 1.0.0
--------------

# show-spec-working Skill

Use this skill when the user asks to see a feature, spec, endpoint, workflow, or behavior working.

This skill is for **demonstration and verification**, not for implementation.

It should prove behavior using the safest available method:

* Frontend walkthrough when a frontend exists and browser automation is available.
* Backend API walkthrough using explicit curl commands when endpoints exist.
* Spec walkthrough when implementation does not exist yet.
* Evidence-based explanation when runnable code is not available.

## Project Context

This project is a women's fashion ecommerce platform using supplier-fulfilled ecommerce.

The project uses:

* Cursor
* Claude Code
* OpenSpec / Spec-Driven Development
* Git and GitHub
* Optional Context7 when available in the current agent environment
* Optional browser automation when available
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

## Trigger Phrases

Use this skill when the user says things like:

* `show me <feature>`
* `demo <feature>`
* `walk me through <feature>`
* `show <feature> working`
* `how <feature> works`
* `prove <feature> works`
* `show the endpoint working`
* `show the OpenSpec change working`

Treat these as demonstration requests, not just explanation requests.

Do not respond only with a high-level summary if a runnable or inspectable demo is possible.

## Inputs

The user may provide:

* OpenSpec change name, for example `product-catalog-management`
* Feature name, for example `product catalog`
* Endpoint, for example `GET /products`
* Frontend route, for example `/products`
* Branch name, for example `feature/product-catalog-management`
* Specific scenario from a spec
* No explicit input, relying on the current session context

If no explicit input is provided, infer the current active OpenSpec change only when it is unambiguous.

If the target is ambiguous, ask the user to choose.

Do not guess.

## Selective Context Loading

Use selective context loading.

Do not read the entire repository.

Always prefer the smallest context needed to demonstrate the requested behavior.

### For OpenSpec change demos

Read:

```text
openspec/config.yaml
openspec/changes/<change-name>/proposal.md
openspec/changes/<change-name>/tasks.md
openspec/changes/<change-name>/specs/*/spec.md
```

Read `design.md` only if needed.

### For backend endpoint demos

Read:

```text
docs/api-spec.yml
docs/backend-standards.md
docs/data-model.md
```

Then inspect only the relevant backend files if implementation exists.

### For frontend demos

Read:

```text
docs/frontend-standards.md
docs/api-spec.yml
```

Then inspect only the relevant frontend route, component, service, and test files if implementation exists.

### For documentation-only demos

Read:

```text
docs/base-standards.md
docs/documentation-standards.md
```

Then inspect the relevant documentation files.

Do not load frontend docs for backend-only demos unless frontend impact is relevant.

Do not load backend docs for frontend-only demos unless API/backend behavior is relevant.

## Demonstration Modes

Choose one mode based on what exists.

### Mode A: Runnable Frontend Demo

Use this when:

* Frontend code exists.
* The relevant route or component exists.
* Local app can be run or is already running.
* Browser automation is available or the user is manually viewing the app.

### Mode B: Runnable Backend API Demo

Use this when:

* Backend code exists.
* Endpoint exists.
* Local API can be run or is already running.
* Required database/state is available.

### Mode C: Spec-Based Demo

Use this when:

* OpenSpec artifacts exist.
* Implementation does not exist yet.
* The user wants to understand how the feature is supposed to work.

In this mode, demonstrate the expected behavior from the spec, but clearly state that it is not a live implementation demo.

### Mode D: Evidence-Based Code Walkthrough

Use this when:

* Code exists but cannot be run safely.
* Required services are unavailable.
* Browser automation is not available.
* The user wants a walkthrough of how the implementation works.

In this mode, show the relevant files, flow, and expected runtime behavior based on code inspection.

## Workflow

### Step 1: Resolve Target

Identify:

* Target change, feature, endpoint, route, or scenario.
* Whether the target is backend, frontend, mixed, documentation-only, or spec-only.
* What evidence is available:

  * OpenSpec artifacts
  * API spec
  * frontend route/component
  * backend endpoint/controller/service
  * tests
  * reports
  * running app/API

If the target is ambiguous, ask the user to choose.

### Step 2: Determine Whether It Can Be Run

Check whether runnable implementation exists.

Do not assume it exists.

If no backend/frontend app exists yet, report:

```text
No runnable application code exists yet for this feature. I can demonstrate the intended behavior from the OpenSpec artifacts instead.
```

If commands are needed to start services, do not run modifying or long-running commands without approval.

Examples of commands that require care:

```bash
npm start
npm run dev
docker compose up
npx prisma migrate dev
npm install
npm ci
```

Do not install dependencies, run migrations, start Docker, or modify the database unless the user approves.

### Step 3: Frontend Demonstration Path

Use this path for frontend or mixed demos when frontend code exists.

1. Identify the route and expected UI behavior.
2. Confirm required local services:

   * frontend server
   * backend API if needed
   * database if needed
3. If the app is not running, ask before starting it.
4. Use browser automation only if available in the current agent environment.
5. Navigate to the target route.
6. Demonstrate each relevant scenario from the spec:

   * page loads
   * data appears
   * form validation
   * search/filter/sort
   * navigation
   * create/update/delete flow, when safe
7. After each meaningful action, verify visible result against the spec.

Do not expose supplier cost or internal supplier data in customer-facing UI demos.

If browser automation is not available, provide manual demo steps and expected results.

### Step 4: Backend API Demonstration Path

Use this path for backend-only or mixed demos when backend code exists.

1. Identify endpoint(s) from `docs/api-spec.yml`.
2. Identify required sample payloads.
3. Confirm whether the API is already running.
4. If the API is not running, ask before starting it.
5. Use explicit `curl` commands when environment data is available.
6. Mask sensitive values in chat output.
7. Prefer read-only requests when possible.
8. For state-changing requests:

   * Explain what state will change.
   * Ask for approval before executing.
   * Restore/reset state immediately after the demo when possible.
   * Confirm restore result.

Example structure:

```bash
curl -X GET "http://localhost:3000/products" \
  -H "Content-Type: application/json"
```

Do not expose supplier costs or internal supplier fields in customer-facing API demo output.

### Step 5: Spec-Based Demonstration Path

Use this path when implementation does not exist yet.

Demonstrate the intended behavior from the OpenSpec change.

For each scenario:

* Name the requirement.
* Show the `WHEN / THEN` behavior.
* Explain what frontend/backend/API behavior would prove it later.
* Identify what test or curl command should exist once implemented.

Example:

```markdown
### Scenario: Product variant is the sellable unit

Spec behavior:
- WHEN an admin creates a product
- AND adds one or more variants
- THEN each variant defines the sellable SKU, public price, size, color, and availability

Future proof:
- API test should verify that products without variants cannot become active.
- UI demo should verify that the admin manages sizes/colors at variant level.
```

Clearly label this as a spec demo, not a live runtime demo.

### Step 6: Evidence-Based Code Walkthrough

Use this path when code exists but cannot be run.

Show:

* Relevant files.
* Entry point.
* Request/UI flow.
* Business rule enforcement.
* Validation.
* Persistence or API interaction.
* Test evidence if available.

Keep it focused.

Do not read unrelated files.

## Browser Automation Requirements

Use browser automation only when available in the current agent environment.

Do not assume browser MCP configured in Cursor is available in Claude Code.

Before using browser tools:

* Check the available tool instructions.
* Follow the tool-specific snapshot/refresh workflow if required.
* Avoid repeated blind retries.
* If blocked, report the blocker and best next action.

If browser automation is unavailable, provide manual steps instead.

## API Demo Requirements

Use real curl commands when possible.

Do not provide pseudocode as if it had been executed.

For every API command shown, clarify whether it was:

* Executed
* Proposed but not executed
* Not executable because the app/API is not running

For state-changing commands:

* Prefer test data.
* Ask before execution.
* Restore state after demo.
* Report restore result.

## Data Safety

Be careful with ecommerce data.

Never expose in customer-facing demos:

* Supplier costs
* Supplier credentials
* Supplier references
* Internal supplier notes
* Internal fulfillment notes
* Private customer data beyond what is necessary for the demo

Do not create, update, or delete records without confirming the impact.

Do not leave demo data behind if a restore path exists.

## Completion Contract

Always finish with a final chat message.

Use this format:

```markdown
## Spec Demo Completed

**Target**: `<spec/change/feature/endpoint/route>`
**Mode**: Frontend | Backend API | Spec-based | Code walkthrough | Mixed

### What Was Demonstrated

- <step/result>
- <step/result>

### Verification Result

- <scenario>: Passed | Failed | Not runnable | Not applicable
- <scenario>: Passed | Failed | Not runnable | Not applicable

### Commands Executed

- `<command>` — <result>
- None

### Data Restore

- Restored | Not needed | Not executed | Failed: <reason>

### Blockers

- None
- <blocker>

### Next

- <recommended next step>
```

## External Tools

* GitHub: use only if branch, PR, commit, or remote state is relevant to the demo.
* Context7: use only if it is available in the current agent environment and official, up-to-date documentation is needed.
* Jira: do not use unless the user explicitly asks for Jira.
* Sentry: do not use unless the app is deployed, Sentry is configured, and the user explicitly asks for runtime error review.
* Browser MCP: optional; use only when available.
* Playwright MCP: optional; use only when available and useful for frontend demonstration.

Do not require any external MCP for this skill.

## Guardrails

* Do not implement code.
* Do not edit files.
* Do not create commits.
* Do not create branches.
* Do not push to GitHub.
* Do not update Jira, Sentry, GitHub, or external systems unless the user explicitly asks.
* Do not start services without approval when that changes local state or may run indefinitely.
* Do not install dependencies automatically.
* Do not run database migrations automatically.
* Do not run Docker commands automatically.
* Do not create/update/delete records without explaining and getting approval.
* Do not expose supplier cost or internal supplier data in customer-facing demos.
* Do not claim a demo was executed if it was only described.
* Do not assume Cursor MCPs are available in Claude Code.
* Keep the demonstration focused on the requested spec, feature, endpoint, or route.
