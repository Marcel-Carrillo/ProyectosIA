## ADDED Requirements

### Requirement: All unhandled errors return a standard JSON error format
The Express application SHALL include a global error handling middleware that catches any unhandled error and returns a JSON response with the structure `{ "success": false, "error": { "message": string, "code": string } }`.

#### Scenario: Unhandled error in a route handler
- **WHEN** a route handler throws an unhandled error and calls `next(error)`
- **THEN** the global error handler returns the appropriate HTTP status code and a body matching `{ "success": false, "error": { "message": "...", "code": "..." } }`

---

### Requirement: 404 routes return a consistent not-found response
The application SHALL handle requests to undefined routes and return HTTP 404 with `{ "success": false, "error": { "message": "Route not found", "code": "NOT_FOUND" } }`.

#### Scenario: Request to an undefined route
- **WHEN** a client sends a request to a route that does not exist (e.g., `GET /undefined`)
- **THEN** the server responds with HTTP 404 and the standard not-found error body

---

### Requirement: Validation errors return HTTP 400
The error handler SHALL map validation errors (identified by a known error type or code) to HTTP 400 responses.

#### Scenario: Validation error is thrown by a handler
- **WHEN** a route handler throws a validation error
- **THEN** the global error handler returns HTTP 400 with `{ "success": false, "error": { "message": "...", "code": "VALIDATION_ERROR" } }`

---

### Requirement: Unexpected errors return HTTP 500 without leaking stack traces
For any error not explicitly mapped to a client-facing status code, the handler SHALL return HTTP 500. Stack traces and internal error details MUST NOT be included in the response body in any environment.

#### Scenario: Unexpected internal error
- **WHEN** an unexpected error occurs in any layer
- **THEN** the server responds with HTTP 500 and `{ "success": false, "error": { "message": "Internal server error", "code": "INTERNAL_ERROR" } }` with no stack trace in the body
