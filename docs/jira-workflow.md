# Jira ↔ OpenSpec ↔ Parallel Agents

This project uses **Jira** as the product backlog and **OpenSpec** as the execution spec. Agents read and update Jira tickets via the Atlassian MCP and the Jira REST API.

## Connection

| Setting | Value |
|---------|--------|
| Site | https://mcarhueti.atlassian.net |
| Project | **MiProyectoIA** |
| Project key | **KAN** |
| Cloud ID | `30bcdef3-10b4-462a-9399-72bb3415f042` |

Authenticate in Cursor: **Settings → MCP → Atlassian → Connect**.

## Automated status transitions

The `/opsx:propose`, `/opsx:apply`, and `/opsx:archive` skills automatically transition Jira tickets as work progresses.

### How it works

Each OpenSpec change directory stores its linked Jira ticket in a `.jira` file (e.g., `openspec/changes/customer-order-management/.jira` contains `KAN-18`). The skills read this file to know which ticket to transition.

### Transition mapping

| Skill event | Jira transition | Transition ID |
|-------------|----------------|---------------|
| `/opsx:propose` — change created | → **En curso** | `21` |
| `/opsx:apply` — implementation starts | → **En curso** | `21` |
| `/opsx:apply` — PR created | → **En revisión** | `31` |
| `/opsx:archive` — change archived | → **Finalizado** | `41` |

### Transition mechanism (two options, tried in order)

**Option 1 — Jira REST API via curl (preferred)**

Set these environment variables so agents can call the Jira API directly:

```bash
# Add to your shell profile (.bashrc, .zshrc) or system env vars (Windows)
export ATLASSIAN_EMAIL="mcarhue@mavile.es"
export ATLASSIAN_API_TOKEN="your-api-token-here"
```

Generate an API token at: https://id.atlassian.com/manage-profile/security/api-tokens

The agent will call:
```
POST https://mcarhueti.atlassian.net/rest/api/3/issue/{KEY}/transitions
Authorization: Basic base64(ATLASSIAN_EMAIL:ATLASSIAN_API_TOKEN)
{"transition":{"id":"<id>"}}
```

**Option 2 — MCP comment fallback (automatic)**

If the env vars are not set or the curl fails, the agent adds a comment to the Jira ticket via `mcp__atlassian__add_jira_comment` noting the state change. The ticket status must then be updated manually in the Jira board.

### Linking a ticket to a change

Pass the Jira ticket key in the propose request:

```text
/opsx:propose customer-order-management for KAN-18
```

The agent extracts `KAN-18` from the context, saves it to `.jira`, and transitions the ticket.

## Issue hierarchy

```
Epic (milestone M0–M6)
 └── Feature (one OpenSpec change)
      ├── Subtask [Backend]  → backend agent + worktree
      ├── Subtask [Frontend] → frontend agent + worktree
      └── Subtask [Integration] → merge branches, E2E, PR
```

## Parallel agent workflow

### 1. Pick a Feature from Jira (e.g. KAN-2)

```text
/enrich-us KAN-2
/opsx:propose product-catalog-management
```

### 2. Open two Cursor chats (or Claude Code sessions)

**Backend agent** — paste:

```text
Use ai-specs/skills/using-git-worktrees/SKILL.md.
Create worktree branch feature/product-catalog-management-backend from master.
Implement Jira subtask KAN-3 only.
/opsx:apply product-catalog-management — backend sections in tasks.md only.
Do not modify frontend/.
```

**Frontend agent** — paste:

```text
Use ai-specs/skills/using-git-worktrees/SKILL.md.
Create worktree branch feature/product-catalog-management-frontend from master.
Implement Jira subtask KAN-4 only.
/opsx:apply product-catalog-management — frontend sections in tasks.md only.
Do not modify backend/.
API contract: openspec/changes/product-catalog-management/design.md
```

### 3. Integration (one agent after both subtasks are done)

```text
Merge feature/product-catalog-management-backend and
feature/product-catalog-management-frontend into feature/product-catalog-management.
Run tests + Playwright E2E. Complete Jira subtask KAN-13. Open PR.
```

### 4. Close Jira

Move Feature to Done when PR is merged. Run `/opsx:archive <change-name>`.

## Current backlog (created in Jira)

### Milestones (Epics)

| Key | Milestone | Status |
|-----|-----------|--------|
| KAN-9 | M0 – Foundation | Finalizado |
| KAN-1 | M1 – Admin Catalog | Finalizado |
| KAN-5 | M2 – Admin Operations | Por hacer |
| KAN-6 | M3 – Fulfillment & Shipments | Por hacer |
| KAN-8 | M4 – Returns & Refunds | Por hacer |
| KAN-7 | M5 – Public Storefront | Por hacer |
| KAN-10 | M6 – Production Hardening | Por hacer |

### M1 – Admin Catalog (Finalizado)

| Key | Feature | OpenSpec change | Subtasks |
|-----|---------|-----------------|----------|
| KAN-2 | Product catalog management | `product-catalog-management` | KAN-3 Backend, KAN-4 Frontend, KAN-13 Integration |
| KAN-11 | Admin category UI | `admin-category-management-ui` | KAN-12 Frontend |
| KAN-14 | Supplier management | `supplier-management` | KAN-16 Backend, KAN-15 Frontend, KAN-27 Integration |
| KAN-17 | Customer management | `customer-management` | — |
| KAN-24 | Public storefront catalog | `storefront-real-products` | — |

### M2 – Admin Operations

| Key | Feature | OpenSpec change | Subtasks |
|-----|---------|-----------------|----------|
| KAN-18 | Customer order management | `customer-order-management` | KAN-28 Backend, KAN-29 Frontend, KAN-30 Integration |
| KAN-19 | Supplier order management | `supplier-order-management` | KAN-31 Backend, KAN-32 Frontend, KAN-33 Integration |

### M3 – Fulfillment & Shipments

| Key | Feature | OpenSpec change | Subtasks |
|-----|---------|-----------------|----------|
| KAN-22 | Shipment management | `shipment-management` | KAN-34 Backend, KAN-35 Frontend, KAN-36 Integration |

### M4 – Returns & Refunds

| Key | Feature | OpenSpec change | Subtasks |
|-----|---------|-----------------|----------|
| KAN-25 | Return request management | `return-request-management` | KAN-37 Backend, KAN-38 Frontend, KAN-39 Integration |
| KAN-20 | Refund management | `refund-management` | KAN-40 Backend, KAN-41 Frontend, KAN-42 Integration |

### M5 – Public Storefront

| Key | Feature | OpenSpec change | Subtasks |
|-----|---------|-----------------|----------|
| KAN-21 | Checkout MVP | `checkout-mvp` | KAN-43 Backend, KAN-44 Frontend, KAN-45 Integration |

### M6 – Production Hardening

| Key | Feature | OpenSpec change | Subtasks |
|-----|---------|-----------------|----------|
| KAN-23 | Admin authentication | `admin-authentication` | KAN-46 Backend, KAN-47 Frontend, KAN-48 Integration |
| KAN-26 | Production deployment | `production-deployment` | KAN-49 Infra, KAN-50 CI/CD |

## Labels

- `parallel-agent` — subtask for isolated agent work
- `backend` / `frontend` — scope
- `openspec` — linked to OpenSpec change
- `integration` — merge + E2E + PR

## Status mapping (suggested)

| Jira status | Meaning |
|-------------|---------|
| Por hacer | Not started |
| En curso | Agent implementing |
| En revisión | PR open |
| Hecho | Merged + archived |
