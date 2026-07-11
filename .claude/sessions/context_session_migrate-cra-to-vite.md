# Context Session: migrate-cra-to-vite

## Working directory (Git worktree — all paths below are relative to it)

`C:\Users\mcarh\Desktop\AI_AGENTS\ProyectoPrueba\.worktrees\feature-migrate-cra-to-vite`

Branch: `feature/migrate-cra-to-vite` (from `origin/develop` @ 721576a). Do NOT touch the main checkout at `C:\Users\mcarh\Desktop\AI_AGENTS\ProyectoPrueba`.

## Change artifacts (read these)

- `openspec/changes/migrate-cra-to-vite/proposal.md` — why + scope + capabilities
- `openspec/changes/migrate-cra-to-vite/design.md` — 9 technical decisions (outDir 'build', Vitest globals, jest→vi codemod, eslint-config-react-app direct dep, proxy in vite.config.ts, VITE_* env, alias @, index.html move)
- `openspec/changes/migrate-cra-to-vite/specs/frontend-skeleton/spec.md` — delta spec
- `openspec/changes/migrate-cra-to-vite/specs/production-deployment/spec.md` — delta spec
- `openspec/changes/migrate-cra-to-vite/tasks.md` — 14 task groups

## Summary

Frontend-only tooling migration: replace CRA (`react-scripts@5.0.1`) with Vite + `@vitejs/plugin-react`, and CRA-embedded Jest with Vitest. Zero runtime behavior change (parity is the acceptance gate). Env vars `REACT_APP_*` → `VITE_*` / `import.meta.env` (21 call sites in `frontend/src` as of the proposal — recount, `develop` has since merged PR #85 which added CJ connection UI files that may add more). All `jest.*` API usage must convert to `vi.*`. Out of scope: react-beautiful-dnd swap, Cypress changes, React/TS upgrades.

## Known gotchas (verified earlier)

- `eslint-config-react-app` is provided transitively by `react-scripts` today; CI runs `npx eslint src` — must become a direct devDependency.
- `jest.mock` hoisting: runtime alias `jest = vi` does NOT work; real codemod needed; `jest.requireActual` → `await vi.importActual` (async).
- `package.json` has a `jest.moduleNameMapper` block with react-router ESM aliases — verify whether Vitest still needs them.
- `index.html` uses `%PUBLIC_URL%` placeholders; Vite does not interpolate them.
- CI: `npm test -- --watchAll=false` is Jest syntax; deploy.yml S3-syncs `frontend/build/` (hence `build.outDir: 'build'`).
- Dockerfile copies only `src`, `public`, `tsconfig.json` — needs `index.html`, `vite.config.ts`, etc.
- Windows/worktree: CRA Jest may not find tests from a worktree without an explicit `--testMatch` override (known issue in this repo).

## Deliverable expected from the frontend planning agent

A per-file implementation plan saved to `.claude/doc/migrate-cra-to-vite/frontend.md` (inside the worktree): exact files to create/modify/delete, exact content sketches for vite.config.ts / tsconfig changes / env.d.ts / index.html, the full recounted list of `process.env.REACT_APP_*` call sites and `jest.*` usages on current `develop` (including PR #85 files), the codemod strategy, and the verification commands. The agent PLANS ONLY — no file edits outside `.claude/doc/`.
