---

name: update-docs
description: Identify and update required technical documentation based on implemented changes, using selective context loading and the project's ecommerce documentation rules.
author: Marcel Carrillo
version: 1.0.0
--------------

# update-docs Skill

Use this skill when implemented changes may require updates to technical documentation.

This skill is intended for local/private project workflows and does not require Jira, Sentry, GitHub MCP, or any external system.

## Purpose

Keep project documentation aligned with the actual implementation, OpenSpec artifacts, API contracts, data model, setup instructions, and business rules.

Documentation updates must be minimal, accurate, and directly related to the implemented change.

## Project Context

This project is a women's fashion ecommerce platform using supplier-fulfilled ecommerce.

Important domain rules:

* Customer orders and supplier orders are different concepts.
* A customer order may generate one or more supplier orders.
* Product variants are the sellable units of the catalog.
* Supplier costs, supplier credentials, supplier notes, supplier references, and internal fulfillment notes must not be exposed through customer-facing APIs.
* Customer-facing order status and internal fulfillment status must be modeled separately.
* Payment status, order status, fulfillment status, supplier order status, shipment status, return status, and refund status must not be mixed.
* The first version prioritizes manual supplier order processing over premature automation.

## When To Use

Use this skill when:

* A feature has been implemented.
* An OpenSpec change modifies requirements, tasks, specs, or design.
* API endpoints, request bodies, response bodies, schemas, status codes, or error formats changed.
* Domain entities, fields, relationships, validations, or persistence rules changed.
* Backend architecture, services, repositories, controllers, Prisma schema, migrations, or testing conventions changed.
* Frontend routes, components, services, forms, states, UI behavior, or testing conventions changed.
* Setup instructions, environment variables, scripts, Docker, Prisma commands, or testing commands changed.
* Documentation rules, AI agent rules, or workflow rules changed.

Do not use this skill for purely exploratory discussion unless the user asks to update documentation.

## Selective Context Loading

Use selective context loading to reduce token usage.

Always read:

* `docs/base-standards.md`
* `docs/documentation-standards.md`

Read additional files only when relevant:

### Data model changes

Read and update:

* `docs/data-model.md`

Use when changes affect:

* Entities
* Fields
* Relationships
* Validation rules
* Status values
* Persistence rules
* Prisma schema
* Migrations
* Supplier/customer/order/fulfillment domain behavior

### API changes

Read and update:

* `docs/api-spec.yml`

Use when changes affect:

* Endpoints
* HTTP methods
* Path parameters
* Query parameters
* Request bodies
* Response bodies
* Status codes
* Error formats
* API schemas
* Customer-facing exposure rules

### Backend changes

Read and update when relevant:

* `docs/backend-standards.md`
* `docs/development_guide.md`

Use when changes affect:

* Backend architecture
* Folder structure
* Controllers
* Routes
* Services
* Repositories
* Domain objects
* Prisma usage
* Database configuration
* Testing commands
* Serverless/deployment conventions

### Frontend changes

Read and update when relevant:

* `docs/frontend-standards.md`
* `docs/development_guide.md`

Use when changes affect:

* Routes
* React components
* Services
* Forms
* UI state
* Validation behavior
* Loading or error states
* Cypress or frontend testing
* Environment variables

### OpenSpec workflow changes

Read and update when relevant:

* `docs/openspec-tasks-mandatory-steps.md`
* `openspec/config.yaml`
* Relevant files under `ai-specs/skills/`
* Relevant files under `ai-specs/agents/`

Use when changes affect:

* SDD workflow
* Required task steps
* Verification rules
* Skill behavior
* Agent behavior
* Token efficiency rules
* External MCP usage

## Instructions

1. Identify what changed.

   Use only relevant context sources such as:

   * Current conversation
   * Git diff
   * OpenSpec change artifacts
   * Modified files
   * Test results
   * Implementation summary

2. Classify the change.

   Determine whether it affects:

   * Data model
   * API contract
   * Backend behavior
   * Frontend behavior
   * Development setup
   * Testing workflow
   * Documentation workflow
   * OpenSpec/SDD workflow
   * AI agent or skill rules
   * Ecommerce business rules

3. Select only the documentation files that are relevant.

   Do not read or update every documentation file by default.

4. Update documentation accurately.

   Documentation must:

   * Reflect the implemented behavior.
   * Stay aligned with `docs/data-model.md` and `docs/api-spec.yml`.
   * Preserve existing structure and naming conventions.
   * Use English only.
   * Avoid speculative future behavior unless explicitly marked as future scope.
   * Avoid changing technology stack, architecture, or business model without explicit user approval.

5. Validate ecommerce consistency.

   When changes affect ecommerce behavior, verify that documentation preserves these rules:

   * `CustomerOrder` and `SupplierOrder` remain separate.
   * Supplier costs and internal supplier data are not exposed in customer-facing APIs.
   * `ProductVariant` remains the sellable unit.
   * Customer order items snapshot product and variant data at purchase time.
   * Status types are not mixed.
   * Manual supplier processing remains the first-version assumption unless explicitly changed.

6. If documentation is already accurate, do not edit files.

   Instead, report:

   ```text
   No documentation updates required.
   ```

7. If required information is missing, ask for clarification before making broad documentation changes.

## Output Format

After reviewing and updating documentation, return:

```markdown
## Documentation Update Summary

### Changed Documentation

- `<file>`: <what changed>

### Documentation Not Changed

- `<file>`: <why no update was required>

### Consistency Checks

- Data model alignment: <Passed | Needs review | Not applicable>
- API spec alignment: <Passed | Needs review | Not applicable>
- Backend standards alignment: <Passed | Needs review | Not applicable>
- Frontend standards alignment: <Passed | Needs review | Not applicable>
- Ecommerce business rules: <Passed | Needs review | Not applicable>

### Open Questions

- <Question, or "None">
```

## Guardrails

* Do not update Jira, Sentry, GitHub, or external systems.
* Do not use external MCPs unless the user explicitly requests them.
* Do not implement code.
* Do not create commits.
* Do not archive OpenSpec changes.
* Do not change project architecture, stack, deployment model, API style, business model, or supplier fulfillment assumptions without explicit user approval.
* Do not read frontend documentation for backend-only changes unless frontend impact must be analyzed.
* Do not read backend documentation for frontend-only changes unless backend or API impact must be analyzed.
* Do not rewrite full documentation files when a targeted edit is sufficient.
* Keep updates minimal, precise, and traceable to the implemented change.
