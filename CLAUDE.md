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
  - **Process 2 — ongoing** (`unsave_new_saved_from_reddit()`, runs first): unsaves the posts saved *this cycle*, read from the in-memory `this.new_data.category_item_ids["saved"]` set, so new saves clear from Reddit promptly. This is the permanent behavior.
  - **Process 1 — one-time backlog** (`unsave_stored_saved_from_reddit()`, runs second): drains the historical not-yet-unsaved rows oldest-first, capped per cycle. Finite — once the backlog is empty `get_saved_items_to_unsave` returns nothing and it no-ops forever.
  - Process 2 stamps its items before Process 1's "not yet unsaved" query runs, so the two sets are disjoint (no item unsaved twice).
- State: `user_item.reddit_unsaved_epoch` (nullable; migration in `sql.init_db`) stamps rows already unsaved. Helpers `get_saved_items_to_unsave` / `mark_items_unsaved_from_reddit`.
- Config (`.env_prod`, via Docker `env_file`): `AUTO_UNSAVE_SYNCED` (default on; `false` disables **both** processes) and `AUTO_UNSAVE_MAX_PER_CYCLE` (caps only the Process 1 backlog batch; Process 2 is naturally small).
- **Reddit's 1000 limit is an effective rolling retention cap, not a listing cap.** Saving past ~1000 silently unsaves the oldest, so there is no intact older tail hiding behind the visible ~1000 (verified empirically 2026-07-20). Consequence: Expanse's saved-record count ≠ Reddit's live saved list — most of the drain's "backlog" is no-op unsaves against items Reddit already evicted (harmless idempotent 200s). Don't assume the drain queue reflects what's actually saved.

## Debugging & Code Style
- Use `console.log` for quick backend tracing; check Docker logs (`docker compose -f compose.prod.yaml logs -f app`). Auto-unsave prints `[unsave:new] user (...)` (Process 2) and `[unsave:backlog] user (...)` (Process 1) lines.
- Follow existing ESLint/Prettier configs.
- For Reddit API issues, check `backend/model/reddit.mjs` (snoowrap requester) and the per-category logic in `backend/model/user.mjs`.
