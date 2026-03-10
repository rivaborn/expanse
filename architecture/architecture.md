# Expanse Architecture

## Overview
Expanse is a selfhosted multi-user web app for externally storing Reddit items (saved, created, upvoted, downvoted, hidden) to bypass Reddit's 1000-item listing limits. It consists of a Node.js/Express backend with Socket.IO for real-time communication, a Svelte (SvelteKit) frontend, and a PostgreSQL database. It's deployed via Docker Compose.

## Tech Stack
- Frontend: Svelte/SvelteKit with Vite
- Backend: Node.js with Express, Socket.IO, Passport.js (Reddit OAuth2)
- Database: PostgreSQL 14 with full-text search (tsvector)
- Reddit API: snoowrap library
- Encryption: Cryptr (AES-256-GCM) for Reddit refresh tokens
- Deployment: Docker Compose (multi-stage Dockerfile)

## Main Program Flows

### 1. Authentication Flow
1. User clicks "log in with Reddit" on landing page
2. `GET /login` triggers Passport Reddit OAuth2 strategy with `duration: "permanent"`
3. Reddit redirects back to `GET /callback` with auth code
4. Passport exchanges code for access/refresh tokens
5. Server checks `ALLOWED_USERS`/`DENIED_USERS` env vars to determine access (three deny conditions)
6. On deny: purges user data and redirects to `/logout`
7. On allow: user saved to DB (refresh token encrypted with Cryptr), session cookie set, redirect to `/`
8. Frontend `load()` in index.svelte calls `/authentication_check` — returns `use_page: "loading"` for new users (no `last_updated_epoch`), `"access"` for returning users
9. `deserializeUser` reconstructs User from DB on each request; errors destroy the session and return 401

### 2. Initial Data Sync (Loading Page)
1. Frontend emits `"page" "loading"` socket event
2. Server calls `user.update(io, socket_id)` which:
   - Creates snoowrap requester with decrypted refresh token; fetches `requester.getMe()`
   - Logs ratelimit status at start
   - Initializes `new_data`, `sub_icon_urls_to_get`, `imported_fns_to_delete`
   - Syncs all 5 categories in parallel via `Promise.all` (each category syncs then imports)
   - For upvoted: custom manual pagination to avoid upstream 500s from large count parameters
   - For other categories: snoowrap `get_listing()` with `before` cursor, up to 100 items
   - Fetches subreddit/user icon URLs (skipping cached ones)
   - Inserts all new data into DB via prepared statements
   - Emits 7 `"update progress"` events for the progress bar
3. Frontend switches from Loading to Access page when progress reaches 100% (after 2s delay)

### 3. Background Sync Cycle
1. `cycle_update_all(io)` runs immediately on startup, then every `max(1, UPDATE_CYCLE_INTERVAL)` minutes
2. Only starts a new cycle if the previous one completed (`update_all_completed === true`)
3. Iterates over all keys in `usernames_to_socket_ids`, skips users updated less than 30s ago
4. For each user, runs a retry loop:
   - On 429 rate limit: parses `x-ratelimit-reset` header or `ratelimitExpiration`, waits, retries with `is_retry=true` (carries partial data)
   - On RateLimitError from snoowrap: waits for reset, retries
   - On 403/404 with `before` cursor: resets stale cursor in DB, saves any partial data already accumulated
   - After each user: if ratelimit is low (< 50 remaining), waits for reset
5. Compares pre/post `latest_new_data_epoch` per category to detect new data
6. Broadcasts to Socket.IO room `view:<username>`:
   - `"show refresh alert"` if new data found
   - `"store last updated epoch"` with updated timestamp

### 4. Data Review Mode (Browse Without Auth)
1. Any visitor can see list of non-purged users from `GET /get_users` (no auth required)
2. Visitor selects a user from dropdown (landing page or access page user switcher)
3. Frontend emits `"set view user"` socket event with username
4. Server validates user exists, leaves previous view room, joins `view:<username>` room, responds with `"view user set"`
5. Read operations (`"get data"`, `"get placeholder"`, `"get subs"`) use `socket.view_username`
6. Write operations (delete, renew, export) are guarded: only execute when `socket.auth_username === socket.view_username`

### 5. Data Retrieval and Display
1. Access page emits `"get data"` with filter (`{category, type, sub, search_str}`), `item_count=25`, `offset`
2. Server queries PostgreSQL with dynamic prepared statements, inner-joins `item` and `user_item` tables
3. Full-text search uses `tsvector` column (indexed on `sub + author + content`) with `to_tsquery`; spaces in query converted to ` & `
4. Returns `{items, item_sub_icon_urls}`
5. Frontend renders items as HTML list items with infinite scroll: IntersectionObserver triggers next `"get data"` call at the halfway point of the current batch

### 6. CSV Import Flow
1. User selects CSV files from Reddit data request (saved_posts.csv, saved_comments.csv, posts.csv, comments.csv, post_votes.csv, hidden_posts.csv) from navbar settings
2. Frontend validates filenames and size (50MB limit), POSTs FormData to `/upload`
3. Backend parses each CSV using `xlsx` library; extracts item fullnames and category-to-ID mappings; excludes IDs containing dots (known anomaly)
4. Stores fullnames in `item_fn_to_import` table and user-item relationships in `user_item` table
5. On next sync cycle, `import_category()` fetches actual item data from Reddit API using `getContentByIds()` in batches of 100 (up to 500 per call)
6. Processed entries are deleted from `item_fn_to_import` after successful insert

### 7. JSON Export Flow
1. User clicks "export data" in navbar settings dropdown
2. Frontend emits `"export"` socket event
3. Server queries all items across all 5 categories via `sql.get_data()` with `item_count="all"`
4. Writes to `tempfiles/{random_15_char_filename}.json`; sets 4-hour auto-delete timeout
5. Emits `"download"` with filename; frontend sets `dl.href` and clicks hidden anchor
6. Server serves file via `res.download()` and deletes it immediately afterward

### 8. Purge Account Flow
1. User types `"purge u/{username}"` in confirmation input in navbar settings
2. Frontend sends `DELETE /purge?socket_id={id}` — socket_id verified server-side against stored mapping
3. Server calls `user.purge()` which runs a 5-step DB transaction: nullifies user fields, deletes user_items, cleans orphaned items, cleans orphaned import entries, cleans orphaned icon URLs
4. Session destroyed via `req.logout()`; frontend shows redirect notice with 10-second countdown then reloads

### 9. Comment Renewal
1. User clicks "renew" button on a comment item (only available for own data)
2. Frontend emits `"renew comment"` with comment ID
3. Server guard checks `socket.auth_username === socket.view_username`
4. Creates fresh snoowrap requester, fetches comment, updates `item.content` in DB
5. Emits `"renewed comment"` with new body; frontend updates DOM in-place

### 10. Item Deletion
Two delete paths, both guarded by `auth_username === view_username`:
- **From Expanse only**: emits `"delete item from expanse acc"` → `sql.delete_item_from_expanse_acc()` (removes user_item, and item itself if orphaned)
- **From Reddit account**: emits `"delete item from reddit acc"` → calls appropriate Reddit API action (unsave/delete/unvote/unhide). If deleted item was the sync cursor, refreshes cursor in DB.

## File Structure

### Backend (`/backend/`)
- `controller/server.mjs` - Main server: Express routes, Socket.IO events, Passport config, startup sequence
- `model/sql.mjs` - PostgreSQL database layer: connection pool, schema init, all CRUD operations
- `model/user.mjs` - User class: Reddit sync (with rate limit retry), import, export, delete; background cycle
- `model/reddit.mjs` - Creates snoowrap requester instances with proper user-agent
- `model/file.mjs` - File operations: directory init, CSV parse, JSON export, pg_dump backups
- `model/utils.mjs` - Utility functions: epoch time, datetime formatting, string helpers
- `model/logger.mjs` - Winston logger setup (info → log.txt, error → error.txt)
- `model/cryptr.mjs` - AES-256-GCM encryption/decryption for Reddit refresh tokens

### Frontend (`/frontend/`)
- `source/globals.js` - Global config: app name, backend URL, Socket.IO client instance
- `source/hooks.js` - SvelteKit hooks: disables SSR (pure SPA)
- `source/utils.js` - UI utilities: time formatting, shake animation, Bootstrap alert helper
- `source/routes/__layout.svelte` - Root layout: waits for socket connection, responsive Bootstrap container, GitHub footer
- `source/routes/__error.svelte` - Error page: HTTP status display with backend request for 404 resolution
- `source/routes/index.svelte` - Main page: auth check, user listing, page routing via svelte:component
- `source/components/landing.svelte` - Landing page: app description, user browse picker, demo video, OAuth scope list, login button
- `source/components/loading.svelte` - Loading page: spinner + progress percentage during initial sync
- `source/components/access.svelte` - Main data view: filters, search, infinite scroll list, user switching, delete/renew/text actions
- `source/components/navbar.svelte` - Navigation: user profile link, settings dropdown with import/export/purge

### Config/Deployment
- `dockerfile` - Multi-stage Docker build
- `compose.prod.yaml` - Docker Compose: PostgreSQL 14 + app container, named volumes, internal network
- `run.sh` - CLI helper: dev/prod build, up, down, update, audit, outdated commands
- `frontend/vite.config.js` - Vite config: SvelteKit plugin, `/backend` proxy, `frontend` path alias, WSL2 polling

## Database Schema

### `user_` table
- `username` (text, PK) - Reddit username
- `reddit_api_refresh_token_encrypted` (text, nullable) - Cryptr-encrypted OAuth refresh token; null when purged
- `category_sync_info` (json, nullable) - Tracks latest fullname cursor per category for incremental sync
- `last_updated_epoch` (bigint, nullable) - Unix epoch of last successful sync; null for new users
- `last_active_epoch` (bigint, nullable) - Unix epoch of last page visit

### `item` table
- `id` (text, PK) - Reddit item ID (without fullname prefix)
- `type` (text, NOT NULL) - `"post"` or `"comment"`
- `content` (text, NOT NULL) - Post title or comment body
- `author` (text, NOT NULL) - `"u/{reddit_username}"`
- `sub` (text, NOT NULL) - `"r/{subreddit}"` or `"u/{username}"`
- `url` (text, NOT NULL) - Full Reddit permalink (trailing slash stripped)
- `created_epoch` (bigint, NOT NULL) - Item creation Unix timestamp
- `search_vector` (tsvector, NOT NULL) - Full-text search index built from `sub + author + content`

### `user_item` table (junction)
- `username` (text, NOT NULL, FK → user_) - User who has this item
- `category` (text, NOT NULL) - `saved`/`created`/`upvoted`/`downvoted`/`hidden`
- `item_id` (text, NOT NULL) - Reddit item ID (no FK constraint on item)
- UNIQUE(username, category, item_id)

### `item_sub_icon_url` table
- `sub` (text, PK) - Subreddit or user name (e.g., `"r/programming"`, `"u/username"`)
- `url` (text, NOT NULL) - Icon image URL, or `"#"` if none found

### `item_fn_to_import` table
- `id` (text, PK) - Item ID from CSV import (without prefix)
- `fn_prefix` (text, NOT NULL) - `"t1"` (comment) or `"t3"` (post)

## Socket.IO Events

### Client → Server
- `"route"` (route) - Notify current route (currently no-op)
- `"page"` (page) - Notify current page (`landing`/`loading`/`access`); triggers sync on `loading`
- `"set view user"` (username) - Switch to viewing a user's data
- `"get data"` (filter, item_count, offset) - Request filtered and paginated items
- `"get placeholder"` (filter) - Request item count for search input placeholder
- `"get subs"` (filter) - Request distinct subreddits for filter dropdown
- `"renew comment"` (comment_id) - Re-fetch comment content from Reddit
- `"delete item from expanse acc"` (item_id, category) - Delete item from Expanse DB only
- `"delete item from reddit acc"` (item_id, category, type) - Delete item from Reddit account
- `"export"` - Generate JSON export file

### Server → Client
- `"view user set"` (`{username, is_online, last_updated_epoch}` or `{error}`) - Response to `"set view user"`
- `"got data"` (data) - Response with `{items, item_sub_icon_urls}`
- `"got placeholder"` (count) - Response with integer item count
- `"got subs"` (subs) - Response with sorted array of subreddit name strings
- `"update progress"` (progress, complete) - Sync progress integer pair (loading page only; 7 total steps)
- `"store last updated epoch"` (epoch) - Updated sync timestamp; broadcast to `view:<username>` room
- `"show refresh alert"` (categories) - New data available; broadcast to `view:<username>` room; array of category names
- `"renewed comment"` (content) - Updated comment body text
- `"download"` (filename) - Export filename ready for `/download?filename=` request

## Environment Variables
- `RUN` - `"dev"` or `"prod"`
- `PORT` - Backend server port (frontend dev server uses PORT, backend uses PORT in prod)
- `VERSION` - App version string (used in snoowrap user-agent)
- `PSQL_CONNECTION` - Full PostgreSQL connection string (takes precedence over individual vars)
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` - Database credentials
- `DB_HOST` - PostgreSQL host (default: `"db"` for Docker service name)
- `DB_PORT` - PostgreSQL port (default: `5432`)
- `SESSION_SECRET` - Secret for signing cookie-session cookies
- `ENCRYPTION_KEY` - Cryptr key for AES-256-GCM token encryption
- `REDDIT_APP_ID`, `REDDIT_APP_SECRET`, `REDDIT_APP_REDIRECT` - Reddit OAuth2 app credentials
- `REDDIT_USERNAME` - Hosting user's Reddit username (appears in API user-agent)
- `ALLOWED_USERS` - Comma-space-separated list of allowed usernames; `"*"` = all allowed
- `DENIED_USERS` - Comma-space-separated list of denied usernames; `"*"` = all denied
- `UPDATE_CYCLE_INTERVAL` - Minutes between background sync cycles (minimum enforced: 1)
- `UPVOTED_MAX_FETCH` - Max items to fetch per upvoted sync walk (default: 500)
- `DEV_DROP_TABLES` - Set to `"true"` in dev to drop and recreate all tables on startup
