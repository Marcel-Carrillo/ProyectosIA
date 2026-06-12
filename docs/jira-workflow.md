# Jira ↔ OpenSpec ↔ Parallel Agents

This project uses **Jira** as the product backlog and **OpenSpec** as the execution spec. Agents read Jira tickets via the Atlassian MCP in Cursor.

## Connection

| Setting | Value |
|---------|--------|
| Site | https://mcarhueti.atlassian.net |
| Project | **MiProyectoIA** |
| Project key | **KAN** |
| Cloud ID | `30bcdef3-10b4-462a-9399-72bb3415f042` |

Authenticate in Cursor: **Settings → MCP → Atlassian → Connect**.

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

| Key | Milestone |
|-----|-----------|
| KAN-9 | M0 – Foundation (done in repo) |
| KAN-1 | M1 – Admin Catalog |
| KAN-5 | M2 – Admin Operations |
| KAN-6 | M3 – Fulfillment & Shipments |
| KAN-8 | M4 – Returns & Refunds |
| KAN-7 | M5 – Public Storefront |
| KAN-10 | M6 – Production Hardening |

### M1 – Admin Catalog

| Key | Feature | OpenSpec change | Parallel subtasks |
|-----|---------|-----------------|-------------------|
| KAN-2 | Product catalog management | `product-catalog-management` | KAN-3 Backend, KAN-4 Frontend, KAN-13 Integration |
| KAN-11 | Admin category UI | `admin-category-management-ui` | KAN-12 Frontend only (API exists) |

### M2 – Admin Operations

| Key | Feature | OpenSpec change |
|-----|---------|-----------------|
| KAN-14 | Supplier management | `supplier-management` | KAN-16 Backend, KAN-15 Frontend |
| KAN-17 | Customer management | `customer-management` |
| KAN-18 | Customer order management | `customer-order-management` |
| KAN-19 | Supplier order management | `supplier-order-management` |

Add `[Backend]` / `[Frontend]` subtasks to KAN-17–KAN-19 before parallel work (same pattern as KAN-14).

### M3–M6 (Features created; add subtasks when starting)

| Key | Feature | OpenSpec |
|-----|---------|----------|
| KAN-22 | Shipment management | `shipment-management` |
| KAN-20 | Refund management | `refund-management` |
| KAN-21 | Checkout MVP | `checkout-mvp` |
| KAN-23 | Admin authentication | `admin-authentication` |

**To add manually in Jira:** Return request management (`return-request-management`), Public catalog (`public-catalog`), Production deployment (`production-deployment`).

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
