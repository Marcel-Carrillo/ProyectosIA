## ADDED Requirements

### Requirement: Prisma client is a singleton exported from the infrastructure layer
`src/infrastructure/prismaClient.ts` SHALL export a single `PrismaClient` instance. All future repositories and infrastructure code MUST import from this module rather than instantiating `PrismaClient` directly.

#### Scenario: Single connection instance across modules
- **WHEN** two different modules import `prismaClient`
- **THEN** both receive the same `PrismaClient` instance (referential equality)

---

### Requirement: Logger provides structured log output at info, warn, and error levels
`src/infrastructure/logger.ts` SHALL export a `logger` object with `info`, `warn`, and `error` methods. Each log entry MUST include at minimum: `level`, `message`, and `timestamp` (ISO 8601). Additional metadata passed as a second argument MUST be included in the output.

#### Scenario: Info log is emitted with metadata
- **WHEN** `logger.info('Server started', { port: 3000 })` is called
- **THEN** a structured log entry with `level: "info"`, `message: "Server started"`, `timestamp`, and `port: 3000` is written to stdout

#### Scenario: Error log is emitted with error context
- **WHEN** `logger.error('Database connection failed', { error: 'timeout' })` is called
- **THEN** a structured log entry with `level: "error"` and the provided metadata is written to stderr

---

### Requirement: Logger does not expose sensitive data
The logger MUST NOT automatically include request bodies, headers, or any field containing the words `password`, `token`, `secret`, `cost`, or `credential` in log output.

#### Scenario: Sensitive field is passed to logger
- **WHEN** `logger.info('Request received', { supplierCost: 24.99 })` is called
- **THEN** the log entry either omits `supplierCost` or redacts its value
