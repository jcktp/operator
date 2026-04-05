---
name: Test Suite & README Update Rules
description: Rules for maintaining tests and keeping README in sync with all changes
type: feedback
---

## Test suite is now in place — maintain it

The project has a Vitest test suite (`npm test`) covering:
- **Unit tests** in `tests/unit/` — pure functions in `lib/`: parsers, utils, auth crypto, model capabilities
- **Integration tests** in `tests/integration/` — DB-backed functions using a real isolated test DB
- **Smoke tests** in `tests/smoke.mjs` — route availability (existing)

After any change to `lib/` functions covered by tests, run `npm test` as part of the verification sequence. The full mandatory order is:
1. `npx tsc --noEmit`
2. `npm run build`
3. `npm test` (when touching tested lib functions)

**Why:** Tests found a real bug on first run — `parseMetrics` panicked on non-array JSON input. The test suite protects against regressions in security-critical and core logic functions.

**How to apply:**
- When adding new pure functions to `lib/`, add matching unit tests in `tests/unit/`.
- When adding new DB-backed lib functions, add integration tests in `tests/integration/`.
- Never delete or skip existing tests.
- The integration test DB is created automatically by `tests/setup/global.ts` — no manual DB setup needed.

## README must stay in sync

When making any change that is not already reflected in `README.md`, update the README. This includes:
- New features or pages
- Changes to model setup modes or model lists
- New API routes or changed route behaviour
- Security changes
- New CLI commands or npm scripts
- New dependencies with user-facing impact

**Why:** Owner requested this explicitly. The README is the primary user-facing document and should always reflect the current state of the app.

**How to apply:** After completing any task, check whether the change warrants a README update and make it if so. Don't add docs for internal-only refactors.
