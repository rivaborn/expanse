# Expanse Project Rules (Svelte + Node.js)

## Tech Stack
- **Frontend:** Svelte (located in `/frontend`)
- **Backend:** Node.js ESM (`.mjs`, located in `/backend`; flat `model/` + `controller/`, no build step)
- **Database:** PostgreSQL (via `pg`; all SQL in `backend/model/sql.mjs`)
- **Reddit API:** `snoowrap` (`backend/model/reddit.mjs`)
- **Deployment:** Docker Compose (`compose.prod.yaml` + `run.sh prod up`)

## Commands
- **Install All:** `cd frontend && npm install && cd ../backend && npm install`
- **Run Frontend (Dev):** `cd frontend && npm run dev`
- **Run Backend (Dev):** `cd backend && npm run dev`
- **Build All:** `./run.sh prod build`

## Architecture Notes
- The frontend acts as a Single Page Application (SPA).
- The backend handles Reddit OAuth and synchronization logic.
- API calls from frontend to backend should be checked in `frontend/src/lib/api.js` (or similar).
- Sync driver: `backend/model/user.mjs` `User.update()` runs per user each cycle (`cycle_update_all`) — syncs each category from Reddit, then `sql.insert_data`. `sql.mjs` is the only DB layer; `insert_data` is idempotent (`on conflict do nothing`).

## Auto-unsave feature (saved category)
- **Two distinct processes**, both in `user.mjs`, called from `update()` **after** `insert_data` and sharing `_unsave_reddit_items()` (idempotent, rate-limit aware, non-fatal, resets the saved cursor if it unsaved the anchor item):
  - **Process 2 — ongoing** (`unsave_new_saved_from_reddit()`, runs first): unsaves the posts saved *this cycle*, read from the in-memory `this.new_data.category_item_ids["saved"]` set, so new saves clear from Reddit promptly. This is the permanent behavior. When it unsaves ≥1 item and `AUTO_UNSAVE_NTFY_URL` is set, it also posts an ntfy notification (`_notify_ntfy()`, non-fatal, 5s-timeout) titled `[unsave:new] <user>: N unsaved`.
  - **Process 1 — one-time backlog** (`unsave_stored_saved_from_reddit()`, runs second): drains the historical not-yet-unsaved rows oldest-first, capped per cycle. Finite — once the backlog is empty `get_saved_items_to_unsave` returns nothing and it no-ops forever.
  - Process 2 stamps its items before Process 1's "not yet unsaved" query runs, so the two sets are disjoint (no item unsaved twice).
- State: `user_item.reddit_unsaved_epoch` (nullable; migration in `sql.init_db`) stamps rows already unsaved. Helpers `get_saved_items_to_unsave` / `mark_items_unsaved_from_reddit`.
- Config (`.env_prod`, via Docker `env_file`): `AUTO_UNSAVE_SYNCED` (default on; `false` disables **both** processes), `AUTO_UNSAVE_MAX_PER_CYCLE` (caps only the Process 1 backlog batch; Process 2 is naturally small), and `AUTO_UNSAVE_NTFY_URL` (optional full ntfy topic url; when set, Process 2 posts a notification per active cycle — on this deployment it points at the homelab ntfy `http://192.168.1.30:2586/Expanse`).
- **Reddit's ~1000 saved limit is a LISTING window, not a retention cap** (corrected 2026-07-26; **supersedes** the earlier 2026-07-20 "retention cap / no older tail" note, which was wrong). Older saves persist server-side *beyond* the visible ~1000; unsaving the visible ones makes Reddit **surface the next tranche of older-but-still-saved items**, which the next sync re-discovers. Verified on `rivaborn`: draining a **12,403** baseline backlog actually unsaved **~17,105** items and the tracked total **grew to 17,308 (+215)** as older saves resurfaced (~850 re-unsaves of items that surfaced again). Consequences:
  - **The drain is a moving target** that peels back older layers, so the backlog does **not** cleanly reach 0 — a small (~200) churn residual of idempotent no-op re-unsaves persists. **Completion signal = "backlog small & flat AND total no longer growing," not backlog==0.** Process 1 is therefore not strictly "finite" (see above): resurfacing feeds it a trickle (~20–50/day) that the gentle drain absorbs.
  - **No data loss — resurfacing captures MORE content, never less.** Every surfaced post is archived (`insert_data` → the `item` table: `content/author/url/sub/type`) **before** it is unsaved, so an older post that resurfaces gets its content captured on its way out. Verified: **17,308/17,308** of rivaborn's saved records have an archived `item` row (0 un-archived).
  - Expanse's saved-record count still ≠ Reddit's live saved list, and many drain unsaves are still idempotent no-op 200s — but the "backlog" is **not** purely against already-evicted items; a real older tail exists and surfaces as you drain.

## Debugging & Code Style
- Use `console.log` for quick backend tracing; check Docker logs (`docker compose -f compose.prod.yaml logs -f app`). Auto-unsave prints `[unsave:new] user (...)` (Process 2) and `[unsave:backlog] user (...)` (Process 1) lines.
- Follow existing ESLint/Prettier configs.
- For Reddit API issues, check `backend/model/reddit.mjs` (snoowrap requester) and the per-category logic in `backend/model/user.mjs`.
