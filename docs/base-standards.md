---

description: This document contains all development rules and guidelines for this project, applicable to all AI agents.
alwaysApply: true
-----------------

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

## 5. Specific Standards

For detailed standards and guidelines specific to different areas of the project, refer to:

* [Backend Standards](./backend-standards.md)
* [Frontend Standards](./frontend-standards.md)
* [Documentation Standards](./documentation-standards.md)
* [Data Model](./data-model.md)
* [API Specification](./api-spec.yml)
* [Development Guide](./development_guide.md)
* [OpenSpec Tasks Mandatory Steps](./openspec-tasks-mandatory-steps.md)

## 6. Token Efficiency and Selective Context Loading

Agents must minimize unnecessary context loading.

* Do not read every documentation file by default.
* Always start with `docs/base-standards.md`.
* Load additional documentation only when it is relevant to the requested task.
* For backend-only tasks, read only:

  * `docs/backend-standards.md`
  * `docs/data-model.md`
  * `docs/api-spec.yml`
  * `docs/openspec-tasks-mandatory-steps.md`
  * `ai-specs/agents/backend-developer.md`
* For frontend-only tasks, read only:

  * `docs/frontend-standards.md`
  * `docs/api-spec.yml`
  * `docs/openspec-tasks-mandatory-steps.md`
  * `ai-specs/agents/frontend-developer.md`
* For documentation-only tasks, read only:

  * `docs/documentation-standards.md`
  * The documents being updated
* For product strategy or requirement refinement, read only:

  * `docs/data-model.md`
  * `docs/api-spec.yml`
  * `ai-specs/agents/product-strategy-analyst.md`
* For backend-only work, do not load frontend standards unless frontend impact must be analyzed.
* For frontend-only work, do not load backend standards unless backend or API impact must be analyzed.
* Load cross-area documentation only when the requested change explicitly affects multiple areas.
* When a document is large, read only the sections directly relevant to the current task whenever the tool or environment allows partial reading.

## 7. Project Agents

For specialized AI agent behavior, refer to:

* [Backend Developer Agent](../ai-specs/agents/backend-developer.md)
* [Frontend Developer Agent](../ai-specs/agents/frontend-developer.md)
* [Product Strategy Analyst Agent](../ai-specs/agents/product-strategy-analyst.md)

Use the relevant agent depending on the type of work:

* Backend changes: use `backend-developer.md`
* Frontend changes: use `frontend-developer.md`
* Product strategy, market analysis, user personas, value proposition, or MVP scope: use `product-strategy-analyst.md`

## 8. Project Skills

* Skills live in `ai-specs/skills`.
* When a request matches a skill, load and follow the corresponding `SKILL.md` automatically before continuing.
* Also load any referenced files in the skill folder when the skill requires them.
* Do not modify skills unless the user explicitly asks for a workflow or skill update.

## 9. Multi-Agent Portability

* Keep reusable AI artifacts in `ai-specs` as the canonical source.
* Agent-specific paths such as `.claude` and `.cursor` should reference canonical files when possible.
* Whenever a file is renamed, moved, or deleted, verify that related references remain valid.
* If symbolic links are used, verify that they remain valid after file moves or folder restructuring.

## 10. Mandatory Spec Updates

When a new business or technical change appears after implementation has started, agents must update the relevant specification artifacts before changing code.

Required order:

1. Update affected requirements, scenarios, tasks, data models, or API contracts.
2. Implement only after the specification reflects the new request.
3. Verify the implementation against the updated specification.
4. Do not apply direct code-only fixes when the change affects documented business behavior.

## 11. Documentation Update Requirements

Agents must update the relevant documentation whenever implementation changes affect documented behavior.

Required documentation updates:

* Update `docs/data-model.md` when entities, fields, relationships, validations, or persistence rules change.
* Update `docs/api-spec.yml` when endpoints, request bodies, response bodies, schemas, status codes, or error formats change.
* Update `docs/backend-standards.md` when backend architecture, dependencies, testing, database, or deployment conventions change.
* Update `docs/frontend-standards.md` when frontend architecture, components, routes, services, UI patterns, or testing conventions change.
* Update `docs/development_guide.md` when setup, environment variables, Docker, Prisma, scripts, or testing commands change.
* Update `docs/documentation-standards.md` when documentation workflow or AI rule update processes change.

## 12. Approval Rules

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
