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
- After a saved item is durably stored, `User.unsave_stored_saved_from_reddit()` (in `user.mjs`, called from `update()` **after** `insert_data`) unsaves a throttled batch of not-yet-unsaved saved rows from Reddit via the `snoowrap` requester. Idempotent, rate-limit aware, non-fatal.
- State: `user_item.reddit_unsaved_epoch` (nullable; migration in `sql.init_db`) stamps rows already unsaved. Helpers `get_saved_items_to_unsave` / `mark_items_unsaved_from_reddit`.
- Config (`.env_prod`, via Docker `env_file`): `AUTO_UNSAVE_SYNCED` (default on; `false` disables) and `AUTO_UNSAVE_MAX_PER_CYCLE` (batch cap, throttles the backlog drain).
- **Reddit's 1000 limit is an effective rolling retention cap, not a listing cap.** Saving past ~1000 silently unsaves the oldest, so there is no intact older tail hiding behind the visible ~1000 (verified empirically 2026-07-20). Consequence: Expanse's saved-record count ≠ Reddit's live saved list — most of the drain's "backlog" is no-op unsaves against items Reddit already evicted (harmless idempotent 200s). Don't assume the drain queue reflects what's actually saved.

## Debugging & Code Style
- Use `console.log` for quick backend tracing; check Docker logs (`docker compose -f compose.prod.yaml logs -f app`). Auto-unsave prints `[unsave] user (...)` lines.
- Follow existing ESLint/Prettier configs.
- For Reddit API issues, check `backend/model/reddit.mjs` (snoowrap requester) and the per-category logic in `backend/model/user.mjs`.
