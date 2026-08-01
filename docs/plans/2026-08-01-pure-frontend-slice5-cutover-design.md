# Pure-Frontend Rewrite — Slice 5: Cutover (Remove Go Backend, Deploy as Static Site)

**Status:** Brainstorm → pending plan
**Date:** 2026-08-01
**Depends on:** Slices 0–4 all green against the Go oracle.
**Scope:** One PR. Deletes the entire Go backend now that every feature runs client-side, and switches deployment to a static site. **This is the point of no return** — once merged, the Go oracle is gone, so it must not land until all prior slices pass.

---

## Requirements

1. **Delete all Go code:** `cmd/`, `endpoint/`, `model/`, `utils/`, `go.mod`, `go.sum`, `.air.toml`, and the `web/static.go` embed directive.
2. **Delete all server-call code:** remove `web/src/client.ts` entirely (every `apiX` function is replaced by local modules in slices 1–4); remove the `/api/*` route concept. A grep for `/api` and `fetch(` must return nothing in app code.
3. **Relocate test fixtures:** move the oracle-validation fixtures (`testdata/*.xlsx`, `testdata/tournament.json`, `testdata/scoresheet template.xlsx`) under `web/` (e.g. `web/testdata/`) as the permanent TS regression baseline; delete Go-only artifacts.
4. **Capture golden outputs before deletion:** before removing Go, freeze the Go-generated reference outputs (entry-import JSON, generated-rounds JSON, schedule JSON, draft `.xlsx`, chart `.xlsx`, scoresheet `.xlsx`) for the fixtures. These become the **permanent regression baseline** since the live oracle disappears.
5. **Static-site build & deploy:** `vite build` produces `web/dist`; add a static-hosting deployment (e.g. GitHub Pages / Netlify / Vercel config or CI workflow). No server process, no binary.
6. **Update docs:** rewrite `docs/ARCHITECTURE.md`, `docs/FUNCTIONALITY.md`, `docs/AI_AGENT_GUIDE.md` to describe the pure-frontend architecture (single TS codebase, feature-sliced, file-as-document + IndexedDB storage, no backend).

---

## Problem

Slices 0–4 deliver a fully client-side app that *coexists* with the now-redundant Go backend (retained as the validation oracle). Once every feature is proven equivalent, the backend is dead weight: it adds build complexity, the FE/BE model duplication the rewrite set out to kill, and a deployment model (single binary + server) the pure-frontend app no longer needs. Cutover removes it.

---

## Approaches considered

- **Big-bang deletion after all slices green (chosen).** Because each feature slice already validated against Go, cutover is pure deletion + deploy/doc updates — low risk *given the precondition*. The cheapest correct option.
- **Gradual backend shrink.** Remove Go feature-by-feature as each slice lands. Rejected — the Go code is the shared oracle for *all* slices; removing it incrementally destroys the validation reference prematurely and complicates each PR.
- **Keep a minimal Go server as an optional fallback.** Rejected — reintroduces the model-sync problem and a deployment the user does not need.

---

## Architecture (end state)

```
repo root/
  web/                the entire application
    src/
      app/            shell, router, document store
      features/       tournament-doc, tournament-config, draw, matches,
                      entry, schedule, roundrobin, scoresheet
      shared/         model (single source of truth), excel, ui
    testdata/         frozen golden fixtures + reference outputs
    ...vite/vue config
  docs/               updated architecture/functionality docs
  (no Go, no go.mod, no cmd/endpoint/model/utils, no embed)
```

Deployment: static hosting of `web/dist`. No runtime server, no binary.

---

## Components

- **Deletions:** all Go paths and `client.ts`.
- **`web/testdata/`:** the fixtures plus the frozen Go reference outputs (golden JSON + golden `.xlsx`).
- **Deploy config:** a static-host config / CI workflow (chosen host TBD — confirm at plan time; candidates: GitHub Pages, Netlify, Vercel).
- **Doc rewrites:** the three `docs/*.md` files.

---

## Data flow

End state: browser loads static assets → all logic runs client-side → data persists as `.json` files (File System Access API / fallback) with IndexedDB autosave (slice 0). No network calls to any server.

---

## Error handling

- Not applicable as runtime behavior — this slice changes build/deploy, not user flows. The risk is *completeness* of deletion (a stray `fetch('/api/...')` or stale import). Mitigated by the grep audit in requirement 2 and the full regression below.

---

## Testing

- **Full regression with no Go present:** run every slice's feature-acceptance scenario end-to-end from a static `vite build` of `dist/` — open/save, draw, generate rounds, entry import, schedule round-trip, chart + scoresheet export — all against the frozen golden outputs. Everything must pass with the Go binary absent.
- **Audit grep:** `grep -rn "/api\|fetch(" web/src` returns nothing in app code.
- **Build gate:** `vite build` succeeds; the produced `dist/` serves correctly from a static file server.

---

## Production-risk areas

- **Low mechanically (deletion), but it is the irreversibility checkpoint.** Once Go is removed, the live oracle is gone; any latent fidelity bug in slices 2–4 can no longer be cross-checked against Go at runtime. Mitigations: (a) do not land until all slices green; (b) freeze golden outputs first (requirement 4) as the permanent baseline; (c) git-tag the last Go-backed commit (e.g. `last-go-backend`) so the oracle is recoverable from history if a regression is later suspected.

---

## Feature acceptance

- **Given** the repo after cutover, **when** it is built (`vite build`) and the resulting `dist/` is served as static files, **then** every feature — open/save document, draw, round generation, entry import, schedule round-trip, round-robin chart and scoresheet export — works correctly with no server and no Go code present.

---

## Out of scope

- Any new features; an in-app schedule editor (deferred across the whole rewrite); changing the storage model from slice 0.
