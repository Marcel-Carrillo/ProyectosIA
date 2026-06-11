# Women's Fashion Ecommerce - Specboot + OpenSpec Setup

This project uses Specboot and OpenSpec to support spec-driven development with AI coding agents.

The goal of this repository is to provide a consistent development workflow, shared technical standards, reusable AI agent roles, and project-specific documentation for building a women's fashion ecommerce application.

## Project Context

This project is a women's fashion ecommerce application.

The initial business model is supplier-fulfilled ecommerce:

* The store does not manage its own warehouse at the beginning.
* Customers place orders through the online store.
* Store administrators process supplier orders in the background.
* Suppliers may ship products directly to customers.
* The system must support future evolution to internal stock, hybrid fulfillment, multiple suppliers, and supplier automation.

Main domain concepts:

* Products
* Product variants
* Categories
* Suppliers
* Customers
* Customer orders
* Supplier orders
* Shipments
* Return requests
* Refunds

## 📁 Repository Structure

```text
.
├── docs/                        # Development standards and specifications
│   ├── base-standards.md        # Core development rules
│   ├── backend-standards.md     # Backend architecture, API, database, testing, security
│   ├── frontend-standards.md    # React frontend standards
│   ├── documentation-standards.md
│   ├── api-spec.yml             # OpenAPI specification
│   ├── data-model.md            # Database and domain models
│   └── development_guide.md     # Local setup and testing guide
│
├── ai-specs/
│   ├── agents/                  # Agent role definitions
│   │   ├── backend-developer.md
│   │   ├── frontend-developer.md
│   │   └── product-strategy-analyst.md
│   ├── scripts/                 # Utility scripts
│   └── skills/                  # Reusable skill prompts and workflows
│
├── openspec/
│   ├── changes/                 # OpenSpec change proposals and tasks
│   ├── specs/                   # OpenSpec specifications
│   └── config.yaml              # OpenSpec project configuration
│
├── .claude/                     # Claude-compatible agent and skill configuration
├── .cursor/                     # Cursor-compatible agent and skill configuration
├── AGENTS.md                    # Generic agent configuration
├── CLAUDE.md                    # Claude-specific configuration
├── codex.md                     # GitHub Copilot/Codex configuration
├── GEMINI.md                    # Gemini-specific configuration
└── README.md
```

## 🤖 Multi-Copilot Support

This repository uses shared documentation and AI specs to support multiple AI coding copilots without duplicating rules.

* **`AGENTS.md`** → Generic agent rules
* **`CLAUDE.md`** → Claude/Cursor-oriented configuration
* **`codex.md`** → GitHub Copilot/Codex-oriented configuration
* **`GEMINI.md`** → Gemini-oriented configuration

All these files should reference the same core rules in `docs/base-standards.md`, ensuring consistency across different AI tools while allowing copilot-specific customizations.

### Why This Approach?

✅ **Single Source of Truth**: Core rules maintained in `docs/base-standards.md`
✅ **Copilot Compatibility**: Different AI tools can use their preferred configuration files
✅ **Consistent Development**: Backend, frontend, API, data model, and documentation standards stay aligned
✅ **Portable Workflow**: The same OpenSpec workflow can be reused across features
✅ **Better AI Output**: Agents work with project-specific ecommerce context instead of generic assumptions

## 🚀 Quick Start

### 1. Install and Initialize OpenSpec

OpenSpec is recommended for this project because it supports a spec-driven workflow.

Requirements:

* Node.js `24.16.0` or higher

Install OpenSpec globally:

```bash
npm install -g @fission-ai/openspec@latest
```

Initialize OpenSpec in the project if it has not been initialized yet:

```bash
openspec init
```

### 2. Review Project Documentation

Before creating features or asking an AI agent to generate code, review the project documentation:

```text
docs/base-standards.md
docs/backend-standards.md
docs/frontend-standards.md
docs/documentation-standards.md
docs/data-model.md
docs/api-spec.yml
docs/development_guide.md
```

These documents define the project's technical and business context.

### 3. Review AI Agent Definitions

Agent definitions are located in:

```text
ai-specs/agents/
```

Main agents:

```text
ai-specs/agents/backend-developer.md
ai-specs/agents/frontend-developer.md
ai-specs/agents/product-strategy-analyst.md
```

Use the relevant agent depending on the type of work:

* Backend changes → `backend-developer.md`
* Frontend changes → `frontend-developer.md`
* Product strategy, user needs, MVP analysis → `product-strategy-analyst.md`

### 4. Review OpenSpec Configuration

The OpenSpec configuration is located at:

```text
openspec/config.yaml
```

It should reference the project's documentation and AI specs.

Example context:

```yaml
context: |
  Tech stack: TypeScript, Node.js, Express, Prisma, PostgreSQL, React, React Bootstrap
  Architecture: Domain-Driven Design with Presentation, Application, Domain, and Infrastructure layers
  Domain: Women's fashion ecommerce with supplier-fulfilled order management
  All code, comments, documentation, and technical artifacts must be in English

  Project specs:
  - docs/base-standards.md
  - docs/backend-standards.md
  - docs/frontend-standards.md
  - docs/documentation-standards.md
  - docs/api-spec.yml
  - docs/data-model.md
  - docs/development_guide.md

  AI agents:
  - ai-specs/agents/backend-developer.md for backend planning and review
  - ai-specs/agents/frontend-developer.md for frontend planning and review
  - ai-specs/agents/product-strategy-analyst.md for product strategy and MVP analysis

  Skills:
  - ai-specs/skills/ for reusable workflows and guidance
```

## ✅ Verify Configuration

After completing setup, verify that the AI copilot can access:

* `docs/base-standards.md`
* `docs/backend-standards.md`
* `docs/frontend-standards.md`
* `docs/documentation-standards.md`
* `docs/api-spec.yml`
* `docs/data-model.md`
* `docs/development_guide.md`
* `ai-specs/agents/`
* `ai-specs/skills/`
* `openspec/config.yaml`

The agent should use these files before creating plans, specs, tasks, or implementation changes.

## 💡 Recommended OpenSpec Workflow

The recommended workflow for this project is:

1. **`/enrich-us`**: Refine a vague idea, user story, or product requirement.
2. **`/ff`**: Create the required OpenSpec change artifacts.
3. **`/apply`**: Implement tasks one by one.
4. **`/verify`**: Validate implementation against the change artifacts.
5. **`/adversarial-review`**: Perform an independent review before archiving.
6. **`/archive`**: Archive the completed change.
7. **`/commit`**: Create focused commits and manage pull request steps.

Example flow:

```bash
/enrich-us product-catalog
/ff product-catalog
/apply product-catalog
/verify product-catalog
/adversarial-review product-catalog
/archive product-catalog
/commit
```

## Optional MCP Integrations

This workflow may be enhanced with MCP servers.

Recommended optional integrations:

* **Playwright MCP**: Browser-based E2E testing for frontend workflows.
* **Jira MCP**: Reading and enriching Jira tickets if the project uses Jira.
* **Context7 MCP**: Library documentation lookup when working with framework-specific implementation details.

If MCP tools are not available, update the relevant skills and workflow instructions accordingly.

## Useful Skills

Skills live in:

```text
ai-specs/skills/
```

The most useful skills for daily work are:

* **`enrich-us`**: Refine vague user stories or ideas into implementation-ready requirements.
* **`using-git-worktrees`**: Create isolated workspaces for feature work.
* **`update-docs`**: Update technical documentation when implementation changes.
* **`code-auditing`**: Review code quality, security, performance, type safety, and dead code.
* **`commit`**: Prepare focused commits.
* **`explain`**: Explain existing code or architectural decisions.
* **`openspec-sync-specs`**: Keep OpenSpec specs aligned with implementation and documentation.

## 📖 Core Development Rules

All development follows the principles defined in:

```text
docs/base-standards.md
```

### Key Principles

1. **Small Tasks, One at a Time**: Use incremental, reviewable changes.
2. **Test-Driven Development**: Write tests before or alongside implementation.
3. **Type Safety**: Use TypeScript and explicit typing.
4. **Clear Naming**: Use descriptive variables, functions, classes, and files.
5. **English Only**: All code, comments, documentation, logs, and technical artifacts must be in English.
6. **90%+ Test Coverage**: Maintain strong test coverage across relevant layers.
7. **Incremental Changes**: Avoid large uncontrolled changes.
8. **Documentation Sync**: Keep documentation aligned with code, API, and data model changes.

## Specific Standards

### Backend Standards

Defined in:

```text
docs/backend-standards.md
```

Backend stack:

* Node.js
* TypeScript
* Express
* Prisma
* PostgreSQL
* Jest
* Serverless Framework
* AWS Lambda

Backend standards cover:

* DDD layered architecture
* Domain entities and value objects
* Application services
* Repository interfaces and implementations
* Express controllers and routes
* Prisma usage
* Error handling
* Security
* Testing
* Manual endpoint testing with curl

### Frontend Standards

Defined in:

```text
docs/frontend-standards.md
```

Frontend stack:

* React
* TypeScript
* Create React App
* React Router
* React Bootstrap
* Bootstrap
* Axios
* Cypress
* Jest
* React Testing Library

Frontend standards cover:

* Component naming
* Service layer architecture
* Routing
* Local state with hooks
* Loading and error states
* Forms
* Accessibility
* Cypress E2E tests
* Environment configuration

### Documentation Standards

Defined in:

```text
docs/documentation-standards.md
```

Documentation standards cover:

* English-only technical artifacts
* API documentation updates
* Data model updates
* README and setup guide maintenance
* Rule update approval process
* AI spec maintenance

## Ecommerce Business Rules

The following business rules must remain consistent across backend, frontend, API, data model, tests, and documentation:

1. **Customer orders and supplier orders are different concepts.**

   * A customer order represents what the customer buys.
   * A supplier order represents what the store requests from a supplier in the background.

2. **A customer order may generate one or more supplier orders.**

   * Multiple suppliers may be involved in fulfilling one customer order.

3. **Supplier data must be protected.**

   * Supplier costs, supplier credentials, supplier notes, supplier references, and internal fulfillment notes must not be exposed through customer-facing APIs.

4. **Customer-facing status and internal fulfillment status must remain separate.**

   * Payment, order, fulfillment, supplier order, shipment, return, and refund statuses must not be mixed.

5. **Product variants are the sellable units.**

   * A product is the catalog item.
   * A product variant represents a specific sellable version, such as size or color.

6. **Order data must use snapshots.**

   * Customer order items must store snapshots of product and variant data at purchase time.

7. **The first version should avoid premature automation.**

   * Manual supplier order processing is acceptable for the first version.
   * The system must remain flexible enough for supplier automation later.

## Development Setup

For local setup instructions, see:

```text
docs/development_guide.md
```

Basic startup order:

```bash
# 1. Start database
docker-compose up -d

# 2. Start backend
cd backend
npm run dev

# 3. Start frontend in another terminal
cd frontend
npm start
```

Expected local URLs:

```text
Backend API: http://localhost:3000
Frontend app: http://localhost:3001
PostgreSQL: localhost:5432
```

## Testing

### Backend Testing

```bash
cd backend

npm test
npm run test:watch
npm run test:coverage
```

### Frontend Testing

```bash
cd frontend

npm test
npm run cypress:open
npm run cypress:run
```

### Manual Endpoint Testing

Backend endpoint testing must be performed with curl when required by OpenSpec tasks.

Manual endpoint tests must:

* Be executed by the coding agent when implementing OpenSpec tasks.
* Verify status codes and response bodies.
* Cover success and error scenarios.
* Restore database state after CREATE, UPDATE, or DELETE tests.
* Be documented in the relevant OpenSpec report folder.

### E2E Testing

Frontend workflows must be tested with Cypress or Playwright MCP when required.

Relevant workflows include:

* Product listing
* Product details
* Category management
* Supplier management
* Customer order creation
* Supplier order creation
* Shipment tracking
* Return request creation
* Refund creation

## API and Data Model

The API contract is defined in:

```text
docs/api-spec.yml
```

The data model is defined in:

```text
docs/data-model.md
```

When implementation changes affect endpoints, schemas, entities, relationships, validation rules, or business rules, update these files.

## Customization Rules

When adapting this project further:

1. Keep the same document set and file names unless explicitly approved.
2. Do not change the agreed technology stack without approval.
3. Do not change the architecture without approval.
4. Keep all technical artifacts in English.
5. Keep backend, frontend, API, data model, and documentation standards internally consistent.
6. Preserve ecommerce business rules across all documentation and implementation.
7. Do not expose internal supplier data in customer-facing contexts.

## Maintaining Standards

* **Single Source of Truth**: Update `docs/base-standards.md` when changing core rules.
* **Documentation Review**: Update relevant documentation whenever code, API, data model, or workflow changes.
* **Team Review**: Standards changes should be reviewed before being applied.
* **Symlink Integrity**: After file renames, moves, or suffix changes, verify and update impacted symlinks.
* **Canonical Placement**: Prefer `ai-specs` as the canonical source and expose through symlinks for `.claude` and `.cursor` compatibility.

## Benefits

### For Developers

* Consistent code quality
* Clear architecture rules
* Strong testing expectations
* Complete project documentation
* Faster onboarding
* Reduced ambiguity when using AI agents

### For AI Coding Agents

* Clear domain context
* Clear backend and frontend boundaries
* Explicit ecommerce business rules
* API and data model references
* Mandatory testing and documentation workflow
* Lower risk of generating generic or outdated code

### For the Project

* Maintainable codebase
* Production-oriented workflow
* Living documentation
* Faster feature development
* Lower technical debt
* Better separation between customer-facing ecommerce and internal supplier fulfillment

## Contributing

When contributing to the project:

1. Read `docs/base-standards.md`.
2. Follow backend or frontend standards depending on the change.
3. Create or update OpenSpec artifacts when needed.
4. Keep changes small and focused.
5. Write or update tests.
6. Run the required tests.
7. Update technical documentation.
8. Verify no customer-facing response exposes internal supplier data.
9. Use descriptive commit messages in English.

## License

This project is private unless stated otherwise.

If a license is required, add it explicitly in this section.
