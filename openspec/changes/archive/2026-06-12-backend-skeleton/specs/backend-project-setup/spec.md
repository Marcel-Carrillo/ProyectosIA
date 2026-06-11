## ADDED Requirements

### Requirement: Backend project is fully configured and installable
The backend project SHALL have a valid `package.json` with all required production and development dependencies, scripts (`dev`, `build`, `test`, `test:coverage`, `lint`, `prisma:generate`), and an `engines` field specifying Node.js `>=24.16.0`.

#### Scenario: Developer installs dependencies
- **WHEN** a developer runs `npm install` in the `backend/` directory
- **THEN** all dependencies install without errors and no peer dependency warnings are emitted for required packages

---

### Requirement: TypeScript compiles in strict mode without errors
The project SHALL include a `tsconfig.json` with `strict: true`, `target: ES2020`, `rootDir: src`, `outDir: dist`, and `moduleResolution: node`.

#### Scenario: Clean TypeScript build
- **WHEN** a developer runs `npm run build` in the `backend/` directory
- **THEN** the TypeScript compiler produces output in `dist/` with exit code 0 and no errors

---

### Requirement: ESLint passes on the initial codebase
The project SHALL include ESLint configuration with `@typescript-eslint` rules. The initial codebase MUST pass linting without errors.

#### Scenario: Linter passes on skeleton code
- **WHEN** a developer runs `npm run lint` in the `backend/` directory
- **THEN** ESLint exits with code 0 and reports no errors

---

### Requirement: Jest is configured with 90% coverage threshold
The project SHALL include `jest.config.js` with `ts-jest` preset and coverage thresholds of 90% for branches, functions, lines, and statements.

#### Scenario: Test suite runs successfully on skeleton
- **WHEN** a developer runs `npm test` in the `backend/` directory
- **THEN** Jest runs and exits with code 0 (no failing tests; coverage thresholds are not enforced until business logic is added)

---

### Requirement: Prisma schema is initialized with datasource and generator
`prisma/schema.prisma` SHALL declare a `postgresql` datasource reading `DATABASE_URL` from environment and a standard `prisma-client-js` generator. No models are included at this stage.

#### Scenario: Prisma client generation succeeds
- **WHEN** a developer runs `npx prisma generate` in the `backend/` directory with `DATABASE_URL` set
- **THEN** the Prisma client is generated without errors

---

### Requirement: Environment variables are documented in `.env.example`
The project SHALL include a `.env.example` file with placeholder values for all required variables: `DATABASE_URL`, `PORT`, `NODE_ENV`, and `FRONTEND_URL`.

#### Scenario: Developer sets up environment
- **WHEN** a developer copies `.env.example` to `.env` and fills in real values
- **THEN** the backend server starts correctly using those values

---

### Requirement: PostgreSQL is available locally via Docker Compose
A `docker-compose.yml` SHALL exist at the project root with a PostgreSQL service using the credentials defined in `docs/development_guide.md` (`ecommerceUser`, `ecommercePassword`, `ecommerceDb`, port 5432).

#### Scenario: Local database starts
- **WHEN** a developer runs `docker-compose up -d` from the project root
- **THEN** a PostgreSQL container starts and is accessible at `localhost:5432` with the configured credentials

---

### Requirement: `.gitignore` excludes sensitive files
The backend SHALL include a `.gitignore` that excludes `.env`, `node_modules/`, `dist/`, and `coverage/`.

#### Scenario: Secrets are not committed
- **WHEN** a developer runs `git status` after creating a `.env` file
- **THEN** the `.env` file does not appear in the list of tracked or untracked files
