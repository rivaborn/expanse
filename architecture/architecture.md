# Expanse Architecture

## Overview
Expanse is a selfhosted multi-user web app for externally storing Reddit items (saved, created, upvoted, downvoted, hidden) to bypass Reddit's 1000-item listing limits. It consists of a Node.js/Express backend with Socket.IO for real-time communication, a Svelte (SvelteKit) frontend, and a PostgreSQL database. It's deployed via Docker Compose.

## Tech Stack
- Frontend: Svelte/SvelteKit with Vite
- Backend: Node.js with Express, Socket.IO, Passport.js (Reddit OAuth2)
- Database: PostgreSQL 14 with full-text search (tsvector)
- Reddit API: snoowrap library
- Encryption: Cryptr (AES-256) for Reddit refresh tokens
- Deployment: Docker Compose (multi-stage Dockerfile)

## Main Program Flows

### 1. Authentication Flow
1. User clicks "log in with Reddit" on landing page
2. `GET /login` triggers Passport Reddit OAuth2 strategy
3. Reddit redirects back to `GET /callback` with auth code
4. Passport exchanges code for access/refresh tokens
5. Server checks `ALLOWED_USERS`/`DENIED_USERS` env vars
6. On success: user saved to DB (refresh token encrypted), session cookie set, redirect to `/`
7. Frontend `load()` calls `/authentication_check` - returns `use_page: "loading"` for new users, `"access"` for returning users
8. `deserializeUser` reconstructs User from DB on each request

### 2. Initial Data Sync (Loading Page)
1. Frontend emits `"page" "loading"` socket event
2. Server calls `user.update(io, socket_id)` which:
   - Creates snoowrap requester with decrypted refresh token
   - Syncs all 5 categories in parallel (saved, created, upvoted, downvoted, hidden)
   - For each category: fetches new items since last sync using Reddit API pagination (`before` parameter = fullname of latest item)
   - Processes imported CSV data from `item_fn_to_import` table
   - Fetches subreddit/user icon URLs
   - Inserts all new data into DB via prepared statements
   - Emits `"update progress"` events (7 steps total) for progress bar
3. Frontend switches from Loading to Access page when progress reaches 100%

### 3. Background Sync Cycle
1. `cycle_update_all(io)` runs immediately on startup, then every `UPDATE_CYCLE_INTERVAL` minutes
2. Iterates over all non-purged users in `usernames_to_socket_ids`
3. For each user: calls `user.update()` (without io/socket_id, so no progress events)
4. Compares pre/post `category_sync_info.latest_new_data_epoch` to detect new data
5. Broadcasts to Socket.IO room `view:<username>` so ALL viewers see updates:
   - `"show refresh alert"` if new data found in active category
   - `"store last updated epoch"` with the updated timestamp

### 4. Data Review Mode (Browse Without Auth)
1. Landing page calls `GET /get_users` to get list of non-purged usernames and which are online (syncing)
2. Any visitor can select a user from dropdown and click "view"
3. Frontend dispatches `"set view user"` action, switches to Access page
4. Access page emits `"set view user"` socket event
5. Server validates user exists, sets `socket.view_username`, joins socket to `view:<username>` room
6. Read operations (`"get data"`, `"get placeholder"`, `"get subs"`) use `socket.view_username`
7. Write operations (delete, renew, export) are guarded: only execute when `socket.auth_username === socket.view_username`

### 5. Data Retrieval and Display
1. Access page emits `"get data"` with filter (category, type, sub, search_str), item_count, offset
2. Server queries PostgreSQL with dynamic prepared statements, joins `item` and `user_item` tables
3. Full-text search uses `tsvector` column with `to_tsquery` for search strings
4. Returns items + subreddit icon URLs
5. Frontend renders items as HTML list with infinite scroll (emits more `"get data"` with offset)

### 6. CSV Import Flow
1. User selects CSV files from Reddit data request (saved_posts.csv, comments.csv, etc.)
2. Frontend POSTs to `/upload` with FormData
3. Backend parses CSV using xlsx library, extracts item fullnames and category mappings
4. Stores in `item_fn_to_import` table and `user_item` table
5. On next sync cycle, `import_category()` fetches actual item data from Reddit API using `getContentByIds()`

### 7. JSON Export Flow
1. User clicks "export data" in navbar settings
2. Frontend emits `"export"` socket event
3. Server queries all items across all categories
4. Writes to temp JSON file, emits `"download"` with filename
5. Frontend triggers download via hidden anchor element
6. File auto-deleted after 4 hours

### 8. Purge Account Flow
1. User types "purge u/{username}" confirmation
2. Frontend sends `DELETE /purge` with socket_id for verification
3. Server calls `user.purge()` which:
   - Nullifies all user fields in `user_` table
   - Deletes user's `user_item` entries
   - Cleans up orphaned items, import entries, and icon URLs
4. Session destroyed, page reloads after 10s countdown

## File Structure

### Backend (`/backend/`)
- `controller/server.mjs` - Main server: Express routes, Socket.IO events, Passport config
- `model/sql.mjs` - PostgreSQL database layer: connection pool, queries, transactions
- `model/user.mjs` - User class: Reddit sync, import, export, delete operations
- `model/reddit.mjs` - Creates snoowrap requester instances
- `model/file.mjs` - File operations: init dirs, parse CSV imports, create JSON exports, DB backups
- `model/utils.mjs` - Utility functions: epoch time, datetime formatting, string helpers
- `model/logger.mjs` - Winston logger setup (info + error log files)
- `model/cryptr.mjs` - Encryption/decryption wrapper for Reddit refresh tokens

### Frontend (`/frontend/`)
- `source/globals.js` - Global config: app name, backend URL, Socket.IO client
- `source/hooks.js` - SvelteKit hooks: disables SSR
- `source/utils.js` - UI utilities: time formatting, element shake, alerts
- `source/routes/__layout.svelte` - Root layout: waits for socket connection, responsive container
- `source/routes/__error.svelte` - Error page: HTTP status display with "return to app" link
- `source/routes/index.svelte` - Main page: auth check, page routing, component dispatch
- `source/components/landing.svelte` - Landing page: app description, user picker, login button
- `source/components/loading.svelte` - Loading page: progress bar during initial sync
- `source/components/access.svelte` - Main data view: filters, search, item list, user switching
- `source/components/navbar.svelte` - Navigation: user profile, import/export/purge settings

### Config/Deployment
- `dockerfile` - Multi-stage Docker build (backend deps -> frontend build -> Ubuntu runtime)
- `compose.prod.yaml` - Docker Compose: PostgreSQL 14 + app container
- `run.sh` - CLI helper: dev/prod build, up, down, update commands
- `vite.config.js` - Vite config: SvelteKit plugin, dev proxy, path aliases

## Database Schema

### `user_` table
- `username` (text, PK) - Reddit username
- `reddit_api_refresh_token_encrypted` (text) - Cryptr-encrypted OAuth refresh token
- `category_sync_info` (json) - Tracks latest fullname per category for incremental sync
- `last_updated_epoch` (bigint) - Last successful sync timestamp
- `last_active_epoch` (bigint) - Last page visit timestamp

### `item` table
- `id` (text, PK) - Reddit item ID (without prefix)
- `type` (text) - "post" or "comment"
- `content` (text) - Title (posts) or body (comments)
- `author` (text) - "u/{username}"
- `sub` (text) - "r/{subreddit}" or "u/{username}"
- `url` (text) - Full Reddit permalink
- `created_epoch` (bigint) - Item creation timestamp
- `search_vector` (tsvector) - Full-text search index on sub + author + content

### `user_item` table (junction)
- `username` (text, FK -> user_) - User who has this item
- `category` (text) - saved/created/upvoted/downvoted/hidden
- `item_id` (text) - Reddit item ID
- UNIQUE(username, category, item_id)

### `item_sub_icon_url` table
- `sub` (text, PK) - Subreddit/user name
- `url` (text) - Icon image URL

### `item_fn_to_import` table
- `id` (text, PK) - Item ID from CSV import
- `fn_prefix` (text) - "t1" or "t3" (Reddit fullname prefix)

## Socket.IO Events

### Client -> Server
- `"route"` (route) - Notify current route
- `"page"` (page) - Notify current page (landing/loading/access), triggers sync on loading
- `"set view user"` (username) - Switch to viewing another user's data
- `"get data"` (filter, item_count, offset) - Request filtered items
- `"get placeholder"` (filter) - Request item count for search placeholder
- `"get subs"` (filter) - Request distinct subreddits for filter dropdown
- `"renew comment"` (comment_id) - Re-fetch comment content from Reddit
- `"delete item from expanse acc"` (item_id, category) - Delete item from Expanse DB
- `"delete item from reddit acc"` (item_id, category, type) - Delete item from Reddit account
- `"export"` - Generate JSON export file

### Server -> Client
- `"view user set"` ({username, is_online, last_updated_epoch} or {error}) - Response to "set view user"
- `"got data"` (data) - Response with items and icon URLs
- `"got placeholder"` (count) - Response with item count
- `"got subs"` (subs) - Response with subreddit list
- `"update progress"` (progress, complete) - Sync progress (loading page only)
- `"store last updated epoch"` (epoch) - Updated sync timestamp (broadcast to view room)
- `"show refresh alert"` (categories) - New data available notification (broadcast to view room)
- `"renewed comment"` (content) - Updated comment content
- `"download"` (filename) - Export ready for download

## Environment Variables
- `RUN` - "dev" or "prod"
- `PORT` - Server port (backend runs on PORT, frontend dev server on PORT-1)
- `VERSION` - App version string
- `PSQL_CONNECTION` / `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `DB_HOST`, `DB_PORT` - Database connection
- `SESSION_SECRET` - Cookie session signing secret
- `ENCRYPTION_KEY` - Cryptr key for token encryption
- `REDDIT_APP_ID`, `REDDIT_APP_SECRET`, `REDDIT_APP_REDIRECT` - Reddit OAuth app credentials
- `REDDIT_USERNAME` - Hosting user's Reddit username (for user-agent)
- `ALLOWED_USERS`, `DENIED_USERS` - Comma-separated access control lists
- `UPDATE_CYCLE_INTERVAL` - Minutes between background sync cycles
- `UPVOTED_MAX_FETCH` - Max items to walk for upvoted category (default 500)
- `DEV_DROP_TABLES` - Set to "true" in dev to drop and recreate tables on startup
