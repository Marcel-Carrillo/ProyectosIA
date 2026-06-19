# Health Check

## Purpose

Defines the health check endpoint used by infrastructure tooling (load balancers, monitoring agents) to verify that the server is running and the database is reachable. The endpoint must be lightweight, unauthenticated, and must not expose internal system details beyond connectivity status.

## Requirements

### Requirement: GET /health returns server and database status

The server SHALL expose a `GET /health` endpoint that returns HTTP 200 with a JSON body `{ "status": "ok", "db": "up" }` when the server is running and the database is reachable. If the database is unreachable, the endpoint SHALL return HTTP 503 with body `{ "status": "error", "db": "down" }`. The DB connectivity probe SHALL be a single lightweight query (e.g. `SELECT 1`) and SHALL NOT cause significant latency.

#### Scenario: Server is running and database is reachable

- **WHEN** a client sends `GET /health` and the database connection succeeds
- **THEN** the server responds with HTTP 200 and body `{ "status": "ok", "db": "up" }`

#### Scenario: Server is running but database is unreachable

- **WHEN** a client sends `GET /health` and the database connection fails
- **THEN** the server responds with HTTP 503 and body `{ "status": "error", "db": "down" }`

---

### Requirement: Health endpoint is not prefixed under /api/admin or /api/public

The `/health` route SHALL be mounted at the root level (not under any versioned or role-based prefix) so that load balancers and monitoring tools can reach it without authentication.

#### Scenario: Health check from infrastructure tooling

- **WHEN** a load balancer or monitoring agent sends `GET /health` with no authentication headers
- **THEN** the server responds with HTTP 200 and the health body when the database is reachable

---

### Requirement: Health response exposes only status and db fields

The health response body SHALL contain only `{ "status": ..., "db": ... }`. It MUST NOT include server version, environment name, connection string, or any other internal information beyond the `status` and `db` fields.

#### Scenario: Response body contains only allowed fields

- **WHEN** a client sends `GET /health`
- **THEN** the response body contains exactly the `status` and `db` fields with no additional fields
