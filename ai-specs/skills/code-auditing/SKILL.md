---

name: code-auditing
description: Perform task-focused or comprehensive code quality audits with selective context loading, local-first evidence, and ecommerce-specific checks.
version: 1.0.0
--------------

# Code Auditing Skill

Use this skill to perform systematic code quality audits.

By default, audits must be **task-focused** and use selective context loading.

Comprehensive repository-wide audits must only be performed when the user explicitly asks for a full audit.

This skill must work for local/private projects without Jira, Sentry, GitHub MCP, or external MCPs.

## Project Context

This project is a women's fashion ecommerce platform using supplier-fulfilled ecommerce.

Critical domain rules:

* `CustomerOrder` and `SupplierOrder` are different concepts.
* A `CustomerOrder` may generate one or more `SupplierOrder` records.
* `ProductVariant` is the sellable unit of the catalog.
* Customer order items must snapshot product and variant data at purchase time.
* Supplier costs, supplier credentials, supplier notes, supplier references, and internal fulfillment notes must not be exposed through customer-facing APIs.
* Customer-facing order status and internal fulfillment status must be modeled separately.
* Payment status, order status, fulfillment status, supplier order status, shipment status, return status, and refund status must not be mixed.
* The first version prioritizes manual supplier order processing over premature automation.

## When to Use

Use this skill for:

* Task-focused code quality audits.
* Security vulnerability assessment.
* Technical debt identification.
* Pre-release code review.
* Best practices verification.
* Dead code detection.
* Dependency and library usage review.
* Pre-archive review support for OpenSpec changes.

Do not run a broad audit automatically after every small task.

For normal SDD flow, prefer this sequence:

```text
/verify → /adversarial-review → optional /code-auditing when risk or scope justifies it
```

## Audit Modes

### 1. Task-Focused Audit

Default mode.

Use when reviewing:

* One OpenSpec change.
* One feature.
* One backend module.
* One frontend route.
* One API endpoint group.
* One bug fix.
* One pull request or local diff.

Inspect only:

* Changed files.
* Directly related supporting files.
* Relevant tests.
* Relevant OpenSpec artifacts.
* Relevant docs.

### 2. Targeted Area Audit

Use when the user asks for a specific area, such as:

* Backend audit.
* Frontend audit.
* Security audit.
* API audit.
* Data model audit.
* Dead code audit.
* Supplier data exposure audit.

Inspect only files related to that area.

### 3. Comprehensive Audit

Use only when explicitly requested.

This mode may inspect the whole repository and generate a broad technical debt report.

Before starting a comprehensive audit, state that it may consume more time and context.

## Selective Context Loading

Always read:

* `docs/base-standards.md`

Read additional documentation only when relevant:

### Backend audit

* `docs/backend-standards.md`
* `docs/data-model.md`
* `docs/api-spec.yml`
* `ai-specs/agents/backend-developer.md`

### Frontend audit

* `docs/frontend-standards.md`
* `docs/api-spec.yml`
* `ai-specs/agents/frontend-developer.md`

### Documentation or workflow audit

* `docs/documentation-standards.md`
* `docs/openspec-tasks-mandatory-steps.md`
* Relevant files under `ai-specs/skills/`
* Relevant files under `ai-specs/agents/`

### OpenSpec change audit

* `openspec/changes/<change-name>/proposal.md`
* `openspec/changes/<change-name>/design.md`
* `openspec/changes/<change-name>/tasks.md`
* Relevant `openspec/changes/<change-name>/specs/*/spec.md`
* Relevant reports under `openspec/changes/<change-name>/reports/` if present

Do not read frontend standards for backend-only audits unless frontend impact must be analyzed.

Do not read backend standards for frontend-only audits unless backend or API impact must be analyzed.

Do not inspect the entire repository by default.

## External Tools and MCPs

External tools are optional and must be used selectively.

Use configured tools only when they add value to the current task.

- GitHub: allowed when the user has connected the repository or explicitly asks for branch, commit, pull request, review, or repository operations.
- Context7: allowed when official, up-to-date library documentation is needed for React, React Router, React Bootstrap, Express, Prisma, Jest, Cypress, Serverless Framework, AWS Lambda, OpenSpec, or other project dependencies.
- Jira: optional, only if the user provides a Jira issue and asks to use Jira.
- Sentry: optional future tool, only when the project is deployed, Sentry is configured, and the user asks for runtime error review.
- Playwright MCP: optional, only when frontend E2E review is applicable and the user requests MCP-based browser verification.

For local/private workflows, use local files, git diff, tests, curl reports, documentation, OpenSpec artifacts, GitHub, and Context7 as appropriate.

Do not use external tools indiscriminately.
Do not use Context7 for every task by default.
Do not use GitHub for local-only checks unless branch, commit, PR, or remote repository state is relevant.

## Audit Phases

### Phase 0: Scope and Baseline

1. Determine audit mode:

   * Task-focused
   * Targeted area
   * Comprehensive

2. Identify scope:

   * OpenSpec change name
   * Changed files
   * Backend module
   * Frontend route
   * API endpoint group
   * Data model area
   * Security area

3. Read only relevant configuration files:

   * `package.json`
   * `tsconfig.json`
   * linting configuration
   * testing configuration
   * Prisma schema when data model is in scope
   * OpenSpec artifacts when an OpenSpec change is in scope

4. Use local evidence when available:

   * `git status`
   * `git diff`
   * `git diff --stat`
   * test output
   * lint output
   * verification reports

5. Do not run commands that modify files unless explicitly requested.

### Phase 1: Discovery

For task-focused audits:

1. List changed files.
2. Group changed files by module or feature.
3. Identify directly related tests.
4. Identify relevant documentation and OpenSpec artifacts.
5. Avoid unrelated files.

For comprehensive audits only:

1. Find code files by type.
2. Create a tracking list.
3. Group files by module or feature.

### Phase 2: File and Module Analysis

Analyze scoped files for:

* Dead code.
* Unused imports, exports, functions, classes, methods, variables, and types.
* Code smells and anti-patterns.
* Duplicated logic.
* Missing validation.
* Missing error handling.
* Security vulnerabilities.
* Performance issues.
* Type-safety issues.
* Overly complex functions.
* Incorrect async or promise handling.
* Outdated or deprecated APIs.
* Inconsistent naming or structure.
* Tests that do not prove behavior.
* Documentation drift.

### Phase 3: Security and Privacy Analysis

Check for:

* Hardcoded secrets.
* SQL injection risks.
* XSS risks.
* Missing input validation.
* Missing authorization checks when auth is in scope.
* IDOR-style access risks when user-owned resources are in scope.
* Exposed sensitive data.
* Excessive logging of private or internal data.
* Unsafe error messages.

For this ecommerce project, always check when relevant:

* `supplierCost` is not exposed through customer-facing APIs.
* Supplier credentials are never returned by APIs.
* Supplier internal notes and references are not visible to customers.
* Internal fulfillment data is not mixed with customer-facing order responses.
* Payment references and refund references are protected.

### Phase 4: Ecommerce Domain Audit

Apply only the checks relevant to the scoped change.

Check that:

* `ProductVariant` is used as the sellable unit.
* A `Product` is not active without valid active variants.
* `compareAtPrice` is greater than or equal to `publicPrice` when provided.
* Customer order items snapshot product name, variant attributes, SKU, and price at purchase time.
* `CustomerOrder` and `SupplierOrder` are not confused.
* A cancelled customer order cannot generate supplier orders.
* Supplier orders are created only from valid paid or processing customer orders.
* Customer-facing order status and internal fulfillment status remain separate.
* Payment, fulfillment, supplier order, shipment, return, and refund statuses are not mixed.
* Manual supplier processing remains the default v1 assumption unless explicitly changed.

### Phase 5: Test and Verification Audit

Review whether tests cover:

* Happy path.
* Validation errors.
* Not-found cases.
* Conflict cases.
* Unauthorized or forbidden cases when auth is in scope.
* Edge cases.
* Data exposure checks.
* Regression cases.
* State transitions.
* Database persistence rules.
* API response schemas.

For backend endpoint changes, check whether curl verification exists when required by `docs/openspec-tasks-mandatory-steps.md`.

For frontend workflow changes, check whether E2E verification exists when applicable.

### Phase 6: Best Practices Verification

Use official documentation only when necessary.

Do not retrieve or read official documentation for every library by default.

Use official documentation when:

* The code uses an unfamiliar or uncertain library pattern.
* The implementation appears to rely on undocumented behavior.
* There is a risk of using deprecated APIs.
* The user explicitly asks for best-practice verification.

Check:

* Framework conventions.
* Library usage.
* TypeScript patterns.
* React component patterns.
* Express route/controller patterns.
* Prisma usage patterns.
* Jest/Cypress testing patterns.

### Phase 7: Dead Code Analysis

Dead code checks may include:

* Unused imports and exports.
* Unused functions, classes, and methods.
* Unused variables and types.
* Unreachable code blocks.
* Unused files.
* Unused dependencies.

Optional tools:

```bash
npx knip --reporter json
```

For Python projects only:

```bash
deadcode . --dry
```

Always verify tool findings before reporting.

Check for false positives:

* Dynamic imports.
* Framework conventions.
* React components used by routing.
* Decorators.
* Re-exports for public API.
* CLI scripts.
* Serverless handlers.
* Test fixtures.
* Generated files.

Do not delete code unless the user explicitly asks for cleanup.

### Phase 8: Prioritized Report

Generate a report with:

* Scope.
* Evidence reviewed.
* Executive summary.
* Findings grouped by severity.
* File-by-file findings when useful.
* Ecommerce-specific findings.
* Security/privacy findings.
* Test coverage gaps.
* Documentation drift.
* Recommended action plan.

## Issue Priority Levels

* **Critical**: Security vulnerability, sensitive data exposure, broken functionality, destructive data issue, clear spec violation.
* **High Priority**: Likely production bug, missing required behavior, serious validation gap, performance bottleneck, unmaintainable design.
* **Medium Priority**: Code quality issue, weak test coverage, best-practice deviation, maintainability concern.
* **Low Priority**: Style, naming, minor clarity, small refactor opportunity.
* **Quick Win**: Less than 30 minutes to fix.

## Output Format

Use this structure:

```markdown
## Code Audit Report

**Scope**: <task / change / module / endpoint / full repo>
**Mode**: Task-focused | Targeted area | Comprehensive
**Sources Reviewed**:
- <files, diffs, specs, tests, docs>

### Executive Summary

<Short summary of the audit outcome>

### Findings

| Priority | Area | File | Finding | Evidence | Recommended Action |
|----------|------|------|---------|----------|--------------------|
| Critical / High / Medium / Low / Quick Win | <area> | <file> | <finding> | <evidence> | <action> |

### Ecommerce Rule Checks

- CustomerOrder vs SupplierOrder separation: <Passed | Failed | Not applicable>
- Supplier internal data exposure: <Passed | Failed | Not applicable>
- ProductVariant as sellable unit: <Passed | Failed | Not applicable>
- Status separation: <Passed | Failed | Not applicable>
- Snapshot behavior: <Passed | Failed | Not applicable>

### Test and Verification Review

- Unit tests: <Passed | Missing | Not applicable>
- Integration/API tests: <Passed | Missing | Not applicable>
- curl verification: <Passed | Missing | Not applicable>
- E2E verification: <Passed | Missing | Not applicable>
- Documentation updates: <Passed | Missing | Not applicable>

### Recommended Action Plan

1. <Action>
2. <Action>
3. <Action>

### Open Questions

- <Question, or "None">
```

## Resources

Reference documents contain detailed optional methodologies:

* `references/audit-methodology.md`
* `references/dead-code-methodology.md`

Use them only when the user requests a comprehensive audit or when the current audit scope requires deeper methodology.

Do not load reference documents by default for small task-focused audits.

## Guardrails

* Do not require Jira, Sentry, GitHub, pull requests, or external MCPs for every audit.
* Use GitHub only when repository, branch, commit, PR, or remote comparison is relevant.
* Use Context7 only when official library documentation is needed.
* Do not use Sentry unless the project is deployed, Sentry is configured, and the user requests runtime error review.
* Do not use Jira unless the user explicitly asks to use Jira.
* Do not inspect the entire repository unless the user asks for a comprehensive audit.
* Do not run modifying commands unless explicitly requested.
* Do not install new dependencies unless explicitly requested.
* Do not implement fixes unless the user asks after the audit.
* Do not create commits.
* Do not archive OpenSpec changes.
* Do not change project architecture, stack, business model, or SDD workflow.
* Keep findings evidence-based.
* Avoid speculative recommendations not tied to code, specs, tests, or documented business rules.
* Keep token usage proportional to audit scope.
