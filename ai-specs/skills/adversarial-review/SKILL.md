---

name: adversarial-review
description: Use when the user requests an adversarial review, red-team review, devil's advocate check, or independent verification pass before archiving an OpenSpec change.
author: LIDR.co
version: 1.0.0
--------------

# adversarial-review Skill

Act as an **independent adversarial reviewer**: assume gaps, flaws, unsafe behavior, or spec drift may exist until they have been checked with evidence.

This skill is intended for the **verification window** of spec-driven development:

```text
after implementation → after local verification → before archive
```

The recommended usage is to run this review from a different agent, session, or context than the one that implemented the change.

Do not prescribe which agent, model, IDE, or external tool must be used. That is the user's choice.

This skill must work for local/private projects without Jira, Sentry, GitHub MCP, or any external MCP.

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

## Inputs

The user may provide one or more of the following:

* OpenSpec change name
* Feature name
* Endpoint or list of endpoints
* Frontend route or list of routes
* File path or module name
* Git branch name
* Pull request URL or reference, if GitHub is being used
* Implementation summary
* Test output
* Verification report path

If input is missing, infer from the current session only when unambiguous.

Resolve scope in this order:

```text
explicit change name → explicit feature/module/endpoint → PR if provided → current active work
```

If scope is ambiguous, ask the user to choose before reviewing.

Do not require Jira.

GitHub PR review is allowed when the user provides a PR or asks to use GitHub.

Do not require Sentry.

## Selective Context Loading

Use selective context loading to reduce token usage.

Always read:

* `docs/base-standards.md`
* `openspec/config.yaml`
* Relevant OpenSpec change artifacts for the selected change

Read additional documentation only when relevant:

### Backend-related review

Read only when backend is in scope:

* `docs/backend-standards.md`
* `docs/data-model.md`
* `docs/api-spec.yml`
* `ai-specs/agents/backend-developer.md`

### Frontend-related review

Read only when frontend is in scope:

* `docs/frontend-standards.md`
* `docs/api-spec.yml`
* `ai-specs/agents/frontend-developer.md`

### Documentation-related review

Read only when documentation changes are in scope:

* `docs/documentation-standards.md`
* The specific documents changed

### Product or business-rule review

Read only when business behavior is in scope:

* `docs/data-model.md`
* `docs/api-spec.yml`
* `ai-specs/agents/product-strategy-analyst.md`

Do not read frontend standards for backend-only reviews unless frontend impact must be analyzed.

Do not read backend standards for frontend-only reviews unless backend or API impact must be analyzed.

Do not inspect the entire repository by default. Inspect only files changed by the implementation and directly related supporting files.

## Mindset

Use an adversarial review mindset:

* Try to break the system.
* Do not rubber-stamp the implementation.
* Look for missing negative paths, edge cases, and invalid assumptions.
* Treat passing tests as evidence, not as proof.
* Treat missing tests as a possible implementation risk.
* Treat spec drift as a first-class finding.
* Calibrate depth to risk: authentication, payments, PII, supplier data, order lifecycle, refunds, and data mutation require stricter scrutiny.

## Workflow

### Step 1 — Resolve review scope

1. Identify the OpenSpec change directory if one exists:

```text
openspec/changes/<change-name>/
```

2. Read the relevant artifacts:

```text
proposal.md
design.md
tasks.md
specs/*/spec.md
reports/
```

3. Extract:

* Acceptance criteria
* Explicit non-goals
* Affected domain concepts
* Required tests
* Documentation requirements
* Verification reports

4. Note anything underspecified:

* Ambiguous acceptance criteria
* Missing error cases
* Missing security constraints
* Missing data model constraints
* Missing API contract details
* Missing frontend states
* Missing test requirements

### Step 2 — Load the implementation side

Prefer local evidence.

Use, when available:

```bash
git status
git diff
git diff --stat
git log --oneline -n 10
```

If a pull request is explicitly provided and accessible, it may be used as an additional implementation surface.

For local/private projects, `git diff` is sufficient.

Map changed files to:

* OpenSpec requirements
* Tasks
* Backend layers
* Frontend areas
* API contracts
* Data model changes
* Documentation updates
* Test coverage

### Step 3 — Review spec and task alignment

Check whether:

* Implementation matches `proposal.md`.
* Implementation follows `design.md`.
* `tasks.md` items are completed or correctly marked.
* Non-goals were respected.
* Required verification reports exist when required.
* Documentation updates were performed when needed.

Flag as findings when:

* Code implements behavior not described in the spec.
* Spec requires behavior that code does not implement.
* Tasks are marked complete without evidence.
* Required tests or reports are missing.
* Documentation is stale after implementation.

### Step 4 — Adversarial pass

For each acceptance criterion or scenario, ask:

1. How could this still fail while appearing to pass?
2. Are there invalid inputs that bypass validation?
3. Are there missing empty-state or not-found cases?
4. Are there duplicated or conflicting state transitions?
5. Are there race conditions or repeated action problems?
6. Are there partial failure cases?
7. Are there authorization or privacy risks?
8. Do tests prove the requirement or only the happy path?
9. Does the API response expose internal supplier data?
10. Does the frontend rely on fields that the API does not guarantee?

### Step 5 — Ecommerce-specific checks

For ecommerce changes, verify:

* `ProductVariant` is treated as the sellable unit.
* A `Product` is not made active without valid active variants.
* `compareAtPrice` is not lower than `publicPrice` when provided.
* Supplier costs are not returned by customer-facing endpoints.
* Supplier notes, credentials, references, and internal fulfillment notes are not exposed to customers.
* Customer-facing order status and internal fulfillment status remain separate.
* Supplier orders are not confused with customer orders.
* A cancelled customer order cannot generate supplier orders.
* Supplier orders are only generated from valid paid or processing customer orders.
* Customer order items snapshot product and variant data at purchase time.
* Payment, fulfillment, supplier order, shipment, return, and refund states are not mixed.

Apply only the checks relevant to the scope.

### Step 6 — Test and verification review

Review available evidence:

* Unit tests
* Integration tests
* API tests
* Manual curl reports
* E2E reports
* Database state verification reports
* Documentation update summaries

Check whether tests include:

* Happy path
* Validation errors
* Not-found cases
* Conflict cases
* Unauthorized or forbidden cases when auth is in scope
* Edge cases
* Regression cases
* Data exposure checks for supplier-sensitive fields

If required tests are missing, classify the finding according to risk.

### Step 7 — External tools and MCPs

External tools are optional.

Use them only when explicitly configured and requested by the user.

* Jira: optional, only if the user provides a Jira issue and requests Jira usage.
* Sentry: optional, only if the project is deployed, Sentry is configured, and the user requests runtime error review.
* Playwright MCP: optional, only when frontend E2E review is applicable and the user wants MCP-based browser verification.
* GitHub or PR tools: allowed when the user provides a PR, asks for PR review, or wants branch/remote comparison.
* Context7: allowed when official library behavior must be verified.

For this local/private workflow, use local files, git diff, tests, curl reports, and OpenSpec artifacts as the default evidence sources.

### Step 8 — Severity and recommendations

Classify each finding:

* **Blocker**: security/privacy issue, data exposure, incorrect behavior, destructive bug, or clear spec violation that should stop archive.
* **Major**: likely bug, missing required behavior, missing required test, or significant design gap that should be fixed before archive.
* **Minor**: clarity, maintainability, low-risk test gap, or documentation improvement.
* **Question / assumption**: requires human confirmation before deciding.

For each finding, state whether the fix belongs in:

* Code
* Tests
* OpenSpec artifacts
* API spec
* Data model documentation
* Technical documentation
* Product/business decision

### Step 9 — Verdict

End with a clear verdict:

* **PASS**: no blockers or majors.
* **PASS WITH GAPS**: only minors or documented follow-ups remain.
* **FAIL**: at least one blocker or major exists.

Also state whether archiving is advisable.

## Output Format

Use this structure:

```markdown
## Adversarial Review

**Scope**: <change / feature / endpoint / PR / branch>
**Sources**:
- <spec path>
- <diff or changed files>
- <test reports>
- <documentation files reviewed>

### Spec and Task Alignment

- <alignment summary>

### Findings

| Severity | Area | Finding | Evidence | Suggested Fix |
|----------|------|---------|----------|---------------|
| Blocker / Major / Minor / Question | <area> | <finding> | <evidence> | <code / tests / spec / docs / decision> |

### Ecommerce Rule Checks

- CustomerOrder vs SupplierOrder separation: <Passed | Failed | Not applicable>
- Supplier internal data exposure: <Passed | Failed | Not applicable>
- ProductVariant as sellable unit: <Passed | Failed | Not applicable>
- Status separation: <Passed | Failed | Not applicable>
- Snapshot behavior: <Passed | Failed | Not applicable>

### Test and Verification Evidence

- Unit tests: <Passed | Missing | Not applicable>
- Integration/API tests: <Passed | Missing | Not applicable>
- curl verification: <Passed | Missing | Not applicable>
- E2E verification: <Passed | Missing | Not applicable>
- Documentation updates: <Passed | Missing | Not applicable>

### Verdict

PASS | PASS WITH GAPS | FAIL

Archiving advisable: Yes | No

### Recommended Next Steps

- <next step>
```

## Guardrails

* Do not praise implementation to balance criticism unless a strength directly mitigates a documented risk.
* Do not skip OpenSpec artifacts when they exist.
* Do not require Jira, Sentry, GitHub, PRs, or external MCPs.
* Do not use external MCPs unless explicitly requested.
* Do not implement fixes during the adversarial review unless the user explicitly asks for fixes after the review.
* Do not create commits.
* Do not archive changes.
* Do not broaden the review beyond the requested scope unless a high-risk adjacent issue is discovered.
* Do not inspect the entire repository by default.
* Keep review depth proportional to risk.
* If required evidence is unavailable, say what is missing and how that affects the verdict.

## Completion

Always end with:

* Verdict.
* Whether archiving is advisable.
* The minimum required next step if the verdict is not PASS.
