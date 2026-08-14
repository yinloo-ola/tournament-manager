# Use Supabase for the team-lineup shared state + auth layer

The team-lineup-submission feature needs identity (per-manager login) and
shared state (concurrent lineup edits across multiple devices) that a single
local `.json` file in one administrator's browser physically cannot provide.
We will keep the existing tournament SPA static (Cloudflare/GitHub Pages) and
add **Supabase free tier** — managed Postgres + auth + row-level security — as
the authoritative store for lineups, manager identities, and the submission
cutoff. We picked Supabase over self-hosted Pocketbase, Cloudflare Workers +
D1, and Firebase to minimize handwritten auth code and security surface; the
cost is a managed-service dependency and tournament data leaving the admin's
local file, which reverses the project's earlier "pure-frontend, no backend"
stance (the Slice 5 cutover, tagged `last-go-backend`).

## Considered options

- **Pocketbase (self-hosted, e.g. Oracle Cloud always-free)** — most standalone,
  open-source single binary with auth + admin UI. Rejected: the user preferred a
  managed service over operating even a binary.
- **Cloudflare Workers + D1** — generous free edge tier. Rejected: requires
  hand-rolling password hashing, sessions, and the API; security burden is on us.
- **Firebase (Spark)** — built-in auth + realtime. Rejected: Google lock-in and
  Firestore data-modeling quirks.
- **Supabase free tier** — chosen. Postgres + auth + RLS with near-zero auth
  code; comfortable free limits for a tournament-scale dataset.
