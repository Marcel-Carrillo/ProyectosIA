---

description: Standards and best practices for technical documentation in this project, including documentation structure, update processes, and language rules.
globs:
alwaysApply: true
-----------------

# Rules and Patterns for Documentation and AI Specs

## Introduction

Technical documentation applies to all documentation related to the project, such as the data model, README, API specs, backend standards, frontend standards, development guides, and other Markdown documents that describe how the project is structured, runs, and operates.

AI specs refers to the documents that explain how AI agents should behave, document, plan, code, review, and collaborate within this project. This includes team agreements, standards, conventions, agent rules, project skills, and workflow instructions.

This project is a women's fashion ecommerce application. The initial business model is supplier-fulfilled ecommerce, where customers place orders through the online store and store administrators process supplier orders in the background. Documentation must preserve this business context consistently across all project files.

## General Rules

* ALWAYS WRITE IN ENGLISH, including comments and any explanation in the files.
* This applies both to creating new documentation and updating existing one.
* This also applies to documentation within the code, including comments, explanations of functions, field descriptions, API descriptions, error messages, logs, and test descriptions.
* User-facing conversation may happen in Spanish, but technical artifacts must always remain in English.
* Do not modify project rules, standards, technologies, architecture, or workflow assumptions without explicit user approval.
* When adapting example templates, preserve the existing structure as much as possible and change only what is needed for this project.

## Technical Documentation

Before making any commit or git push, or when asked to document a commit, you must ALWAYS review which technical documentation should be updated.

When updating documentation, I will:

1. Review all recent changes in the codebase.
2. Identify which documentation files need updates based on the changes. Some clear examples:

   * For data model changes: Update `data-model.md`.
   * For API changes: Update `api-spec.yml`.
   * For backend architecture, libraries, database migrations, scripts, deployment, or setup changes: Update `backend-standards.md` or the relevant development guide.
   * For frontend architecture, UI patterns, component standards, routing, styling, or state management changes: Update `frontend-standards.md`.
   * For documentation workflow or AI rules changes: Update `documentation-standards.md`, `base-standards.md`, or the relevant AI spec file.
3. Update each affected documentation file in English, maintaining consistency with existing documentation.
4. Ensure all documentation is properly formatted and follows the established structure.
5. Verify that all changes are accurately reflected in the documentation.
6. Report which files were updated and what changes were made.

## Ecommerce Documentation Rules

Documentation must consistently reflect the project business model.

The following concepts must be documented clearly and consistently:

* Product catalog
* Product variants
* Categories
* Suppliers
* Customers
* Customer orders
* Supplier orders
* Shipments
* Return requests
* Refunds
* Supplier-fulfilled ecommerce
* Future support for internal stock, hybrid fulfillment, multiple suppliers, and supplier automation

The following business rules must remain visible in relevant documentation:

* Customer orders and supplier orders are different concepts.
* A customer order may generate one or more supplier orders.
* Supplier costs, supplier references, supplier notes, and internal fulfillment data must never be exposed through customer-facing APIs.
* Customer-facing order status and internal fulfillment status must be modeled separately.
* The first version should prioritize manual supplier order processing over premature automation.
* The system must remain flexible enough to support future internal stock or hybrid fulfillment.

## Data Model Documentation

When the data model changes, update `docs/data-model.md`.

Required updates include:

* Adding new entities.
* Removing entities.
* Renaming entities.
* Adding, removing, or renaming fields.
* Changing validation rules.
* Changing relationships.
* Changing status values.
* Changing primary keys or foreign keys.
* Changing business rules related to persistence.
* Updating the entity-relationship diagram when relationships change.

The data model documentation must include:

* Entity descriptions.
* Field definitions.
* Validation rules.
* Relationships.
* Entity relationship diagram.
* Key design principles.
* Notes and future considerations when relevant.

## API Documentation

When API endpoints, request bodies, response bodies, status codes, schemas, or error formats change, update `docs/api-spec.yml`.

Required updates include:

* Adding new endpoints.
* Removing endpoints.
* Renaming endpoints.
* Changing HTTP methods.
* Changing request schemas.
* Changing response schemas.
* Changing pagination or filtering behavior.
* Changing error response formats.
* Changing authentication or authorization requirements.
* Changing business behavior exposed through the API.

The OpenAPI specification must remain aligned with the implemented Express routes and controllers.

## README and Setup Documentation

Update the README or development guide when changes affect:

* Installation steps.
* Environment variables.
* Local development commands.
* Database setup.
* Prisma setup.
* Migration workflow.
* Seed data.
* Testing commands.
* Build commands.
* Deployment commands.
* Docker or infrastructure setup.
* Required external services.

Documentation must make it possible for a new developer or AI agent to understand how to run, test, and work with the project.

## AI Specs

This rule establishes a mandatory process for the AI to:

* Learn from user feedback, guidance, and suggestions during interactions.
* Identify opportunities to improve existing development rules based on these learnings.
* Keep the AI's assistance aligned with evolving project needs and user expectations.
* Incorporate user feedback into the AI's operational framework to maximize its value.
* Avoid changing project rules without explicit approval.

This rule is applicable after any interaction where the user provides explicit or implicit feedback, suggestions, corrections, new information, or expresses preferences.

The AI MUST actively analyze all user interactions for such learning opportunities, not only passively waiting for direct feedback, to proactively refine its understanding and the project's best practices.

However, the AI MUST NOT directly modify rules, standards, project assumptions, technologies, architecture, or workflows without explicit user approval.

## Rule Update Process

When user feedback suggests that a rule or standard should change, the AI must follow this process:

1. Identify the specific feedback or correction from the user.
2. Identify the affected file or section.
3. Explain the proposed change clearly.
4. Ask for explicit user approval before applying the change.
5. Apply only the approved change.
6. Confirm what was changed after implementation.

## Common Pitfalls and Anti-Patterns to Be Avoided by the AI

* **Skipping Approval Process:** Applying rule modifications without obtaining explicit user review and approval first.
* **Unlinked Proposals:** Proposing rule changes without clearly connecting them to the specific user feedback or insights gained from the interaction.
* **Imprecise Modifications:** Suggesting modifications without precisely identifying which rule or specific sections within a rule should be changed, hindering effective user review.
* **Unaddressed Feedback:** Not initiating the learning and review process when the user provides relevant feedback that could improve the rules.
* **Scope Creep:** Updating multiple unrelated rules simultaneously or making changes that exceed the scope of the feedback received.
* **Unprompted Rule Changes:** Modifying rules proactively when there is no direct connection to user feedback or a learning opportunity. Rule updates should be reactive and feedback-driven.
* **Missing Update Confirmation:** Failing to notify the user after a rule modification has been successfully implemented following their approval.
* **Technology Drift:** Replacing the agreed technology stack without user approval.
* **Architecture Drift:** Changing the agreed architecture or folder structure without user approval.
* **Business Context Drift:** Forgetting that the project is a women's fashion ecommerce application with supplier-fulfilled order management.
* **Documentation Drift:** Updating code, API contracts, or data models without updating the corresponding documentation.
