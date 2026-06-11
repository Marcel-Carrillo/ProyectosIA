# Health Check

## Purpose

Defines the health check endpoint used by infrastructure tooling (load balancers, monitoring agents) to verify that the server is running. The endpoint must be lightweight, unauthenticated, and must not expose any internal system details.

## Requirements

### Requirement: GET /health returns server status
The server SHALL expose a `GET /health` endpoint that returns HTTP 200 with a JSON body `{ "status": "ok" }` when the server is running normally.

#### Scenario: Server is running and healthy
- **WHEN** a client sends `GET /health`
- **THEN** the server responds with HTTP 200 and body `{ "status": "ok" }`

---

### Requirement: Health endpoint is not prefixed under /api/admin or /api/public
The `/health` route SHALL be mounted at the root level (not under any versioned or role-based prefix) so that load balancers and monitoring tools can reach it without authentication.

#### Scenario: Health check from infrastructure tooling
- **WHEN** a load balancer or monitoring agent sends `GET /health` with no authentication headers
- **THEN** the server responds with HTTP 200 and the health body

---

### Requirement: Health response does not expose internal details
The health response body SHALL contain only `{ "status": "ok" }`. It MUST NOT include server version, environment name, database connection state, or any other internal information.

#### Scenario: Response body is minimal
- **WHEN** a client sends `GET /health`
- **THEN** the response body is exactly `{ "status": "ok" }` with no additional fields
