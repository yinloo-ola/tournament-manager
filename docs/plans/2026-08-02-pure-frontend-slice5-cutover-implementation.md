# Implementation Plan: Pure-Frontend Slice 5 — Cutover (Remove Go Backend, Deploy as Static Site)

## Overview
Design: `docs/plans/2026-08-01-pure-frontend-slice5-cutover-design.md`

Delete the entire Go backend now that every feature runs client-side (slices 0–4 all green). Relocate test fixtures under `web/`, remove the vite dev-server proxy, add a static-site deploy config, and rewrite the architecture docs. **This is the point of no return** — once merged, the Go oracle is gone, so it must not land until all prior slices pass.

**Intended branch** (created during `pwk-executing-tasks`): `feature/pure-frontend-slice5-cutover`.

**What's already done (slice 4):** `client.ts` is deleted; zero non-comment `/api` references in app code; no `fetch(` calls in export handlers. The only remnants of the backend are: the Go source tree, `web/static.go` (embed directive), `go.mod`/`go.sum`/`.air.toml`, the vite dev-server proxy (`/api → :8082`), `testdata/` at repo root, and Go-oriented docs.

**Golden outputs already frozen and committed** (verified: `go test ./endpoint/... ./model/...` all pass):
- Entry import: `singles.golden.json`, `doubles.golden.json`, `team.golden.json` + `.rows.json` variants (6 files)
- Schedule: `schedule.golden.json`, `draft_matches.golden.json` (2 files)
- Chart: `chart.golden.xlsx` (1 file)

These live in `web/src/features/.../__tests__/golden/` and are the **permanent regression baseline** — the live oracle disappears with this slice.

**Ordering rationale:**
- **R1** relocates `testdata/` under `web/` and updates all TS test path references. Done first so the TS suite is self-contained before Go is deleted.
- **R2** deletes all Go code + dev-server proxy + embed directive, then runs the grep audit. The point of no return — `full` checkpoint + `parallel` review.
- **R3** adds the static-site deploy config (GitHub Pages CI workflow).
- **R4** rewrites the three architecture docs to describe the pure-frontend architecture.

---

## Setup

- **Verify all golden outputs are current:** `go test ./endpoint/... ./model/... -count=1` — all pass (confirmed at plan time). The committed goldens match Go's output.
- **Tag the last Go-backed commit:** `git tag last-go-backend` on the commit before the first cutover change. This makes the oracle recoverable from history if a regression is later suspected.
- **How to verify setup worked:** Go tests pass (oracle green); `npx vitest run` passes (TS green); `vue-tsc --build --force` clean.

---

## Requirement 1: Relocate test fixtures under `web/`

Move `testdata/` from the repo root to `web/testdata/` so the TS test suite is fully self-contained. Update every test file that references the old `../testdata` path.

Files to move: `Men Singles.xlsx`, `Mens Doubles.xlsx`, `Mens Team.xlsx`, `players.csv`, `scoresheet template.xlsx`, `tournament.json`, `tournament.invalid.json`.

### Acceptance criteria
- Given `testdata/` at the repo root, when the relocation runs, then all 7 fixture files exist under `web/testdata/` and the original `testdata/` directory is removed.
- Given a test file that previously used `resolve(process.cwd(), '../testdata', name)`, when updated, then it uses `resolve(process.cwd(), 'testdata', name)` (or equivalent relative to `web/`).
- Given the updated test paths, when `npx vitest run` executes from `web/`, then all tests that load fixtures (entry import, scoresheet, cloneSheet, readWorkbook, model parse) pass — no file-not-found errors.
- Given the `testdata/` directory is gone from the repo root, when `go test ./...` runs, then Go tests that referenced `../testdata` fail (expected — they're deleted in R2). This is noted but not a regression: the Go tests are about to be removed.

### Integration tests
- `should load all fixtures from web/testdata/` — given the relocated paths, when the full vitest suite runs, then every test that reads a fixture file passes (implicitly verified by the existing suite — no new test needed, just the path update).
- `should have no references to ../testdata` — given the source tree after relocation, when grepping `web/src/` for `'../testdata'`, then zero matches are found.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- The path change is mechanical but touches 9 test files. A missed path causes a file-not-found failure that's immediately visible.
- The `testdata/` move must happen atomically with the path updates — don't move files without updating references, or the suite breaks mid-requirement.

---

## Requirement 2: Delete Go backend + cleanup

Delete all Go source, build config, and server-side remnants. Run a comprehensive grep audit to verify no stray references remain.

**Deletions:**
- Go source directories: `cmd/`, `endpoint/`, `model/`, `utils/`
- Go build files: `go.mod`, `go.sum`, `.air.toml`
- Go embed: `web/static.go`
- Vite dev-server proxy: the `server.proxy` block in `web/vite.config.ts` (forwards `/api` to `:8082` — dead code after cutover)

### Acceptance criteria
- Given the repo before deletion, when R2 runs, then `cmd/`, `endpoint/`, `model/`, `utils/`, `go.mod`, `go.sum`, `.air.toml`, and `web/static.go` are deleted.
- Given `web/vite.config.ts`, when the proxy is removed, then no `proxy` or `/api` reference remains in the config.
- Given the repo after deletion, when grepping for Go artifacts (`grep -rn "go\." web/`, `grep -rn "embed" web/`), then no Go-specific references remain in `web/`.
- Given the repo after deletion, when grepping app code for server calls (`grep -rn "/api\b" web/src/ --include="*.ts" --include="*.vue" | grep -v "^.*:.*//"`), then zero non-comment matches are found.
- Given the repo after deletion, when grepping for `fetch(` in app code (`grep -rn "fetch(" web/src/ --include="*.ts" --include="*.vue" | grep -v __tests__ | grep -v node_modules`), then zero matches are found.
- Given the repo after deletion, when `npx vue-tsc --build --force` runs, then it succeeds (no dangling Go type imports).
- Given the repo after deletion, when `npx vitest run` runs, then all tests pass with no Go binary present.
- Given the repo after deletion, when `cd web && npx vite build` runs, then it succeeds and produces `web/dist/`.

### Integration tests
- `should have no Go directories remaining` — given the repo after deletion, when checking for `cmd/`, `endpoint/`, `model/`, `utils/`, then none exist.
- `should have no Go build files` — given the repo after deletion, when checking for `go.mod`, `go.sum`, `.air.toml`, `web/static.go`, then none exist.
- `should have no /api proxy in vite config` — given `web/vite.config.ts` after cleanup, when reading the file, then no `proxy` key exists.
- `should have no non-comment /api references in app code` — given `web/src/` after cleanup, when grepping for `/api` excluding comments, then zero matches.
- `should build successfully with vite build` — given the repo after deletion, when running `npx vite build` from `web/`, then it exits 0 and `dist/index.html` exists.
- `should pass full test suite with no Go present` — given the repo after deletion, when running `npx vitest run`, then all tests pass.

### Checkpoints: full
### Review: parallel

### Production-risk notes
- **This is the point of no return.** Once Go is deleted, the live oracle is gone. Mitigations: (a) `last-go-backend` git tag created in Setup; (b) golden outputs already frozen in R1; (c) full test suite + build gate must pass before the commit lands.
- The vite proxy removal is part of this requirement because the proxy is a Go-server artifact. Removing it has no runtime effect on the built app (the proxy is dev-server only) but keeps the config clean.
- `web/static.go` is the Go embed directive that served the built SPA from the Go binary. Its deletion is what severs the last code-level tie between Go and the frontend.

---

## Requirement 3: Static-site deploy config

Add a CI workflow that builds `web/` and deploys `dist/` to GitHub Pages. No server process, no binary — just static hosting.

### Acceptance criteria
- Given the repo, when a push to `main` triggers the CI workflow, then it runs `npm ci && npx vite build` in `web/` and deploys `web/dist/` to GitHub Pages.
- Given the GitHub Pages deployment, when a user navigates to the site URL, then the SPA loads and client-side routing works (including deep-link refresh, which requires a `404.html` fallback or SPA-serving config).
- Given `web/vite.config.ts`, when the site is deployed to a GitHub project page (subpath like `/<repo-name>/`), then `base` is set correctly so assets resolve. (If deploying to a custom domain or root path, `base` can remain `/`.)

### Integration tests
- `should have a deploy workflow file` — given the repo, when checking `.github/workflows/`, then a deploy workflow exists.
- `should produce a valid dist on build` — given `web/`, when running `npx vite build`, then `dist/index.html` and `dist/assets/` exist.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- The deploy target defaults to GitHub Pages. If the user prefers Netlify/Vercel, the workflow file changes but the build command (`npx vite build`) stays the same.
- SPA routing on GitHub Pages requires a `404.html` that redirects to `index.html` (or a copy of `index.html` as `404.html`). The vite build produces `index.html`; the workflow copies it to `404.html` if needed.
- `base` in vite.config.ts: GitHub project pages serve from `/<repo-name>/`, requiring `base: '/<repo-name>/'`. Custom domains or root deployments use `base: '/'`.

---

## Requirement 4: Update docs

Rewrite `docs/ARCHITECTURE.md`, `docs/FUNCTIONALITY.md`, and `docs/AI_AGENT_GUIDE.md` to describe the pure-frontend architecture. Remove all references to Go, the backend, the embed directive, API routes, and the single-binary deployment model.

### Acceptance criteria
- Given `docs/ARCHITECTURE.md`, when read after rewrite, then it describes: a single Vue 3 + TypeScript codebase under `web/`; feature-sliced architecture (`features/`, `shared/`, `app/`); File System Access API + IndexedDB storage (slice 0); no backend, no server, no Go; static-site deployment via `vite build` → `dist/`.
- Given `docs/ARCHITECTURE.md`, when grepping for Go/backend references (`grep -in "go backend\|gin\|embed\|/api\|endpoint/\|cmd/\|model/\|single.binary\|server process"`), then zero matches are found.
- Given `docs/FUNCTIONALITY.md`, when read after rewrite, then it describes user flows (open/save, draw, round generation, entry import, schedule round-trip, chart/scoresheet export) as fully client-side operations with no server calls.
- Given `docs/AI_AGENT_GUIDE.md`, when read after rewrite, then it describes the build/test commands (`npx vitest run`, `npx vite build`, `vue-tsc --build --force`) without mentioning `go test`, `go run`, or `air`.
- Given all three docs, when grepping for `client.ts` or `validTournament`, then zero matches are found (these were deleted in slice 4).

### Integration tests
- `should have no Go/backend references in architecture docs` — given the rewritten docs, when grepping for Go-specific terms, then zero matches.
- `should describe the static-site deployment model` — given `docs/ARCHITECTURE.md`, when read, then it mentions `vite build`, `dist/`, and static hosting.

### Checkpoints: spec
### Review: inline

### Production-risk notes
- The docs are the onboarding surface for future contributors and AI agents. Stale Go references would mislead them into looking for a backend that doesn't exist.
- The `docs/lessons.md` file accumulates cross-slice patterns (including Go→TS port lessons) — these should be preserved as historical context even after Go is deleted. They're not rewritten.

---

## Feature acceptance

- **Given** the repo after cutover, **when** it is built (`cd web && npx vite build`) and the resulting `dist/` is served as static files, **then** the full vitest suite passes (233+ tests) with no Go code present, `vue-tsc --build --force` is clean, the grep audit returns zero `/api`/`fetch(`/Go references in app code, and every feature (open/save, draw, round generation, entry import, schedule round-trip, chart + scoresheet export) works entirely client-side.