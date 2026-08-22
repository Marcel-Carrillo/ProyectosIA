---

description: This document contains all development rules and guidelines for this project, applicable to all AI agents.
alwaysApply: true

---

## 1. Core Principles

* **Small tasks, one at a time**: Always work in baby steps. Never move forward more than one implementation step at a time.
* **Test-Driven Development**: Start with failing tests for new business logic whenever practical.
* **Type Safety**: All application code must be typed. Prefer TypeScript for backend and frontend code.
* **Clear Naming**: Use clear, descriptive names for variables, functions, classes, modules, database fields, and API contracts.
* **Incremental Changes**: Prefer small, focused, reviewable changes over large modifications.
* **Question Assumptions**: Always identify unclear business rules, technical assumptions, and hidden dependencies.
* **Pattern Detection**: Detect repeated code patterns and propose refactoring when useful.
* **Spec First**: Business rules must be documented before implementation when they affect data models, workflows, APIs, payments, orders, stock, suppliers, or fulfillment.

## 2. Language Standards

* **English Only for Technical Artifacts**: All technical artifacts must use English, including:

  * Code
  * Variables
  * Functions
  * Classes
  * Comments
  * Error messages
  * Log messages
  * Documentation
  * API documentation
  * Database tables and columns
  * Configuration files
  * Scripts
  * Git commit messages
  * Test names and descriptions

The user may communicate in Spanish, but generated technical artifacts must remain in English.

## 3. Project Context

This project is an online store for women's fashion and accessories.

The initial business model is supplier-fulfilled ecommerce:

* The store does not manage its own warehouse at the beginning.
* Customers place orders through the online store.
* Store administrators process customer orders and place the corresponding supplier orders in the background.
* Suppliers ship products directly to customers.
* The system must support future changes to this model, including internal stock, multiple suppliers, automated supplier integrations, hybrid fulfillment, or warehouse-based fulfillment.

The system must be designed with flexibility around:

* Products
* Product variants
* Sizes
* Colors
* Categories
* Suppliers
* Supplier references
* Supplier costs
* Stock policy
* Customers
* Customer orders
* Customer order items
* Supplier orders
* Supplier order items
* Shipment tracking
* Returns
* Refunds
* Payment status
* Fulfillment status

**Storefront surfaces:** the live customer site is still the React app in `frontend/` with the Express API in `backend/`. A Shopify Online Store 2.0 theme lives at `shopify/theme` (operator-approved stack addition). Theme quality is gated by Theme Check, not the React ESLint path. See `docs/shopify-theme-standards.md`.

## 4. Business Rules

* A customer order and a supplier order are different concepts.
* A customer order may generate one or more supplier orders.
* A product may be fulfilled by an external supplier, internal stock, or a hybrid model in the future.
* Product availability must not assume internal warehouse stock by default.
* Product variants are the sellable units of the catalog.
* Customer order items must snapshot product and variant data at purchase time.
* Supplier data must be kept separate from public product data.
* Supplier cost must never be exposed to customers.
* Supplier credentials, supplier notes, supplier references, and internal fulfillment notes must not be exposed through customer-facing APIs.
* Customer-facing order status and internal fulfillment status must be modeled separately.
* Payment status, order status, fulfillment status, supplier order status, shipment status, return status, and refund status must not be mixed.
* The system must allow manual supplier order processing at the beginning.
* The system should be prepared for future supplier automation.
* The first version should prioritize manual control over premature automation.

## 5. Evidence-Based Real-Time Task Completion Marking

When implementing tasks from any `tasks.md` file, agents MUST mark each sub-task `[x]` immediately after completing and verifying it.

A task is not complete when the agent believes it is implemented.
A task is complete only when there is objective evidence that the implementation exists and works, per the evidence rules in Section 6 (Mandatory Verification Gate).

Required sequence:

1. Complete the sub-task.
2. Verify the sub-task with concrete evidence (see Section 6 for what counts as valid/invalid evidence).
3. Record the evidence in the response.
4. Edit `tasks.md` on disk and change `- [ ]` to `- [x]`.
5. Move to the next sub-task.

If verification fails, is unavailable, or is inconclusive, the task MUST remain unchecked.
Never mark a task `[x]` based only on intent, assumption, or partial implementation.

If the session is interrupted, `tasks.md` must accurately reflect only verified completed work.

## 6. Mandatory Verification Gate

Before claiming that any task, feature, bug fix, deployment, or PR step is complete, agents must provide verification evidence.

Valid evidence includes at least one of:

* A passing unit/integration/E2E test.
* A successful command output.
* A successful curl/API response.
* A file path and line numbers showing the implementation.
* A Playwright screenshot or browser verification for UI behavior.
* A database query proving the expected persisted state.

Invalid evidence:

* "Implemented."
* "Done."
* "Looks correct."
* "Should work."
* "The code has been updated."
* Any claim without file paths, command output, tests, or runtime verification.

For every completed item, the response must include:

* What was changed.
* Where it was changed.
* How it was verified.
* The command/test/check used.
* The result of that verification.

Completion claims without evidence are forbidden.

Examples of acceptable completion statements:

* `Implemented in backend/src/modules/products/product.service.ts:42-88 and verified with npm test -- product.service.test.ts.`
* `Endpoint verified with curl GET /api/public/products returning 200.`
* `Frontend behavior verified with Playwright on /products page.`
* `OpenSpec task 2.3 marked complete after test ProductService should create variants passed.`

Examples of forbidden completion statements:

* `Done.`
* `All tasks completed.`
* `Implemented successfully.`
* `This should now work.`
* `I have updated everything.`

## 7. Git, Branch, Commit, and PR Rules

Agents must verify git state before any commit, PR, merge, archive, or deployment operation.

Before committing, agents must run and report:

* `git status`
* `git branch --show-current`
* `git diff --stat`
* `git diff --cached --stat` when applicable

Commit rules:

* Always load and follow the required commit `SKILL.md` before committing.
* Never commit directly with raw git commands unless the commit skill explicitly allows it.
* Never commit unrelated changes.
* Never include secrets, credentials, `.env` files, local logs, build artifacts, or temporary files.
* Commit messages must be in English.

Branch rules:

* Feature work must be done on a feature branch.
* Feature PRs must target `develop`, not `master`.
* Archive commits must be made on `develop`, not on the feature branch.
* Before creating a PR, check whether an existing PR already exists for the same branch.
* Never create duplicate PRs.

Before creating a PR, agents must verify:

* Correct source branch.
* Correct target branch.
* No duplicate PR exists.
* Tests have passed.
* OpenSpec tasks are verified and checked.
* Required documentation has been updated.

## 8. AWS and Deployment Rules

Before any AWS deployment, agents must run a deployment preflight.

Required preflight checks:

* Confirm current AWS account.
* Confirm AWS region.
* Confirm `serverless.yml` region.
* Default AWS region is `eu-north-1` unless the user explicitly says otherwise.
* Confirm required environment variables.
* Confirm Lambda package size is acceptable.
* Confirm IAM permissions are available.
* Confirm API Gateway routes.
* Confirm CORS configuration.
* Confirm cookie and SameSite settings when authentication is involved.
* Confirm frontend production API base URL.
* Confirm backend health endpoint after deployment.

Deployment rules:

* Never deploy before tests pass.
* Never deploy if region is ambiguous.
* Never deploy if required environment variables are missing.
* Never expose supplier costs, supplier credentials, internal notes, or private fulfillment data through public APIs.
* Never use `komabones@gmail.com` for AWS SES or corporate email configuration.
* Use the corporate/Mavile email address for store-related email configuration.

## 9. Session Preflight for Large Tasks

For large tasks involving implementation, deployment, GitHub, Jira, Stripe, OAuth, or AWS, agents must run a preflight before editing code.

The preflight must check:

* Current git branch.
* Working tree status.
* Target branch.
* GitHub CLI authentication.
* Required MCP server availability.
* Required environment variables.
* AWS region when deployment is involved.
* Relevant documentation files to load.
* Relevant skill files to load.
* Test commands available for the affected area.

Agents must report blockers before modifying files.

If environment variables appear missing in Claude Code but may exist at Windows level, agents must check the Windows registry through PowerShell before assuming they are unavailable.

## 10. Specific Standards

For detailed standards and guidelines specific to different areas of the project, refer to:

* [Backend Standards](./backend-standards.md)
* [Frontend Standards](./frontend-standards.md)
* [Documentation Standards](./documentation-standards.md)
* [Data Model](./data-model.md)
* [API Specification](./api-spec.yml)
* [Development Guide](./development_guide.md)
* [OpenSpec Tasks Mandatory Steps](./openspec-tasks-mandatory-steps.md)

## 11. Token Efficiency and Selective Context Loading

Agents must minimize unnecessary context loading.

* Do not read every documentation file by default.
* Always start with `docs/base-standards.md`.
* Load additional documentation only when it is relevant to the requested task.

For backend-only tasks, read only:

* `docs/base-standards.md`
* `docs/backend-standards.md`
* `docs/data-model.md`
* `docs/api-spec.yml`
* `docs/openspec-tasks-mandatory-steps.md`
* `ai-specs/agents/backend-developer.md`

For frontend-only tasks, read only:

* `docs/base-standards.md`
* `docs/frontend-standards.md`
* `docs/api-spec.yml`
* `docs/openspec-tasks-mandatory-steps.md`
* `ai-specs/agents/frontend-developer.md`

For documentation-only tasks, read only:

* `docs/base-standards.md`
* `docs/documentation-standards.md`
* The documents being updated.

For product strategy or requirement refinement, read only:

* `docs/base-standards.md`
* `docs/data-model.md`
* `docs/api-spec.yml`
* `ai-specs/agents/product-strategy-analyst.md`

Additional context-loading rules:

* For backend-only work, do not load frontend standards unless frontend impact must be analyzed.
* For frontend-only work, do not load backend standards unless backend or API impact must be analyzed.
* Load cross-area documentation only when the requested change explicitly affects multiple areas.
* When a document is large, read only the sections directly relevant to the current task whenever the tool or environment allows partial reading.

## 12. Project Agents

For specialized AI agent behavior, refer to:

* [Backend Developer Agent](../ai-specs/agents/backend-developer.md)
* [Frontend Developer Agent](../ai-specs/agents/frontend-developer.md)
* [Product Strategy Analyst Agent](../ai-specs/agents/product-strategy-analyst.md)

Use the relevant agent depending on the type of work:

* Backend changes: use `backend-developer.md`
* Frontend changes: use `frontend-developer.md`
* Product strategy, market analysis, user personas, value proposition, or MVP scope: use `product-strategy-analyst.md`

## 13. Project Skills

* Skills live in `ai-specs/skills`.
* When a request matches a skill, load and follow the corresponding `SKILL.md` automatically before continuing.
* Also load any referenced files in the skill folder when the skill requires them.
* Do not modify skills unless the user explicitly asks for a workflow or skill update.

Mandatory skill-loading rules:

* Before any large task involving implementation, deployment, GitHub, Jira, Stripe, OAuth, AWS, or OpenSpec, agents MUST load and follow `ai-specs/skills/preflight/SKILL.md`.
* Before marking any OpenSpec task from a `tasks.md` file as complete, agents MUST load and follow `ai-specs/skills/openspec-verify/SKILL.md`.
* Before any commit, agents MUST load and follow the required commit skill from `ai-specs/skills`.
* If multiple skills apply to the same request, agents MUST load all relevant skills before editing code.
* Agents must mention which skills were loaded before starting implementation.

## 14. Multi-Agent Portability

* Keep reusable AI artifacts in `ai-specs` as the canonical source.
* Agent-specific paths such as `.claude` and `.cursor` should reference canonical files when possible.
* Whenever a file is renamed, moved, or deleted, verify that related references remain valid.
* If symbolic links are used, verify that they remain valid after file moves or folder restructuring.

## 15. Mandatory Spec Updates

When a new business or technical change appears after implementation has started, agents must update the relevant specification artifacts before changing code.

Required order:

1. Update affected requirements, scenarios, tasks, data models, or API contracts.
2. Implement only after the specification reflects the new request.
3. Verify the implementation against the updated specification.
4. Do not apply direct code-only fixes when the change affects documented business behavior.

## 16. Documentation Update Requirements

Agents must update the relevant documentation whenever implementation changes affect documented behavior.

Required documentation updates:

* Update `docs/data-model.md` when entities, fields, relationships, validations, or persistence rules change.
* Update `docs/api-spec.yml` when endpoints, request bodies, response bodies, schemas, status codes, or error formats change.
* Update `docs/backend-standards.md` when backend architecture, dependencies, testing, database, or deployment conventions change.
* Update `docs/frontend-standards.md` when frontend architecture, components, routes, services, UI patterns, or testing conventions change.
* Update `docs/development_guide.md` when setup, environment variables, Docker, Prisma, scripts, or testing commands change.
* Update `docs/documentation-standards.md` when documentation workflow or AI rule update processes change.

## 17. Approval Rules

Agents must not change the following without explicit user approval:

* Technology stack
* Architecture
* Folder structure
* Database engine
* API style
* Testing framework
* Deployment model
* Business model
* Supplier fulfillment assumptions
* Documentation rules
* AI agent rules
* OpenSpec workflow rules

When in doubt, ask before changing.
