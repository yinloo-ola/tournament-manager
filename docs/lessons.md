# Lessons

Reusable patterns and pitfalls. Generic rules only — strip domain specifics.

## Testing
- **Don't verify a function against its own output.** A round-trip like `serialize(parse(serialize(t))) === serialize(t)` is circular — a bug present in *both* halves hides. Assert against an *independent* expected (a real fixture or hand-written literal) plus `instanceof` for class identity.
- **Register an observer before the event it must observe.** A test that mutates state, *then* starts a `watch`, asserts the watch fired — it can't have. Order: observer first.
- **`fake-indexeddb` resolves request callbacks on the task queue, not the microtask queue.** Component tests driving IndexedDB-backed state need a macrotask wait (`setTimeout`) before `flushPromises`/DOM assertions — `flushPromises` alone returns before IDB settles.
- **Browser-API wrappers are thin and hard to unit-test directly.** Make orchestration take an injectable port (e.g. a `FileSource`/`FileSink` interface) and unit-test *that*; the browser glue gets real-browser/manual validation.

## Vue / reactivity
- **`ref()` deep-reactifies object values into proxies.** Opaque external objects (e.g. `FileSystemFileHandle`) stored in a ref lose identity — use `shallowRef`, or reference-equality assertions fail.
- **`toEqual` ignores prototypes.** Pair it with `toBeInstanceOf(Class)` when class identity matters.

## IndexedDB
- **One database = one schema/version owner.** Two modules each opening the same DB at their own version race: `onupgradeneeded` only fires on a version *change*, so a store a second module adds is never created for a DB already at the older version. Centralize `openDb` + all `createObjectStore` calls at one version.
- **A transaction auto-closes once its request queue drains.** Don't `await` between requests expecting them to share a transaction — do one logical operation per transaction.
- **A "poison" record (corrupt/unparseable) loaded on startup re-fails every launch.** Self-heal: catch the parse failure on the resume path and delete the bad record.

## Parsing & ingestion
- **Validate untrusted documents at the ingestion boundary, not inside the permissive factory.** `parse` (which ingests files / IDB records) should enforce the canonical shape and throw a typed `ParseError`; the constructor/factory (`Entry.from`) is also used for *trusted* in-memory objects, so making it strict breaks those call sites. Keep the factory permissive; let the entry point be strict. Same rule applies to any "from wire" function.

## ExcelJS internals
- **ExcelJS's `_columns` array is 0-indexed; the public API (`getColumn(n)`) is 1-based.** The internal `worksheet._columns` stores Column objects at index `n-1`, but each Column's `.number` is `n`. When iterating `_columns` directly (e.g. for a deep-copy helper), start at index 0, not 1 — otherwise the first column (often the only one with a custom width) is silently skipped.
- **`mergeCells` propagates the master cell's style to all cells in the range by default.** When cloning a worksheet that has merges, non-master merge cells in the clone get the master's style, which may differ from the source's individual cell styles. For style-comparison tests, skip non-master merge cells (`cell.type === ValueType.Merge`).

## File System Access API
- **The pickers take a single options object, not an array.** `showOpenFilePicker([{...}])` silently drops the `types` filter; pass `showOpenFilePicker({ types: [...] })`.
- **In-place writes leak an exclusive lock if `close()` is skipped.** Wrap `createWritable()`/`write()`/`close()` in `try/finally`, or the next write to the same handle fails with `NoModificationAllowedError`.
- **Persist the file handle across reloads if you want in-place save to survive a refresh.** A module-level handle ref resets to null on reload; restore it (with permission re-grant) on the resume path, or save takes the new-file/download path instead.

## Go → TypeScript ports
- **Decide error-message parity at the throw site, not by habit.** Go `fmt.Errorf("...: %w", err)` wraps context (e.g. a category short name) around an inner error. Ask: does the UI or any test assert the *wrapped* top-level string, or only the *inner* message? If only the inner message is surfaced (e.g. `"not enough players"`), throw the inner error directly; if endpoint-string parity matters, reconstruct the full wrapped message. Document the chosen parity per port so a later refactor doesn't silently narrow a user-facing message.

  - A port that is a **synchronous** function returning a value and throwing on error (no `async`/`Promise` return) is invoked synchronously at the orchestration layer: the orchestrator's own `try/catch` intercepts the throw directly. Do not re-wrap a sync-thrower in an `await`/promise chain — it converts the synchronous throw into an unhandled rejection and mis-routes the `Error`, which is exactly the failure to assert in orchestration tests (assert the throw surfaces via `alert`/`rejects.toThrow` and assert no `fetch`).

## Refactoring / relocation
- **Treat a relocation as a verbatim move with import rebasing**: the relocated file must `diff` to zero except import lines rewritten to the project alias (`@/…`). Deletion of the original is safe **iff** a residual-importer grep is empty for the deleted symbol/paths — verify 'zero live importers,' never 'only legacy importers,' before `rm`. Co-locate a `__tests__/` dir with each relocated module (matching the project's test glob) so regression coverage moves with the code and stays green at every gate.

## Review & verification
- **An unreliable automated reviewer must not block completed work**: capture live verdicts where the tool delivers them; cover dimensions it timed out on via author self-review against directly reproducible evidence (rerun the green suite + static checks such as `vue-tsc --build --force`). Treat repeated reviewer timeouts (same symptom across every scope and thinking budget) as an infra pattern — assert, don't retry — and record it so a stalled review is attested on evidence rather than silently re-spawned.
