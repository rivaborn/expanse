# server.mjs - Main Server Entry Point

## Overview
The main server file that sets up Express HTTP server, Socket.IO real-time communication, Passport.js Reddit OAuth2 authentication, and all route/event handlers. This is the application's entry point.

## Imports
- `socket.io` - WebSocket server for real-time bidirectional communication
- `express` - HTTP framework
- `http` - Node.js HTTP module (used to create server from express app)
- `cookie-session` - Session management via signed cookies
- `passport` / `passport-reddit` - Reddit OAuth2 authentication strategy
- `crypto` - Node.js crypto (imported but not actively used in routes)
- `fs` - File system operations (for temp file cleanup after download)
- `express-fileupload` - Multipart file upload handling
- Internal modules: `file`, `sql`, `user`, `utils`

## Configuration
- `allowed_users` (Set) - Usernames allowed to use the app (from `ALLOWED_USERS` env var, comma-space separated). `"*"` means all users allowed.
- `denied_users` (Set) - Usernames explicitly denied (from `DENIED_USERS` env var). `"*"` means all users denied.
- Console.log/error are patched at startup to prepend ISO timestamp to all log messages.
- Socket.IO `maxHttpBufferSize`: 1MB. CORS `origin: "*"` in dev mode, none in prod.
- Cookie session: 30-day expiry, httpOnly, sameSite: "lax", rolling expiry (timestamp updated on each request).
- File upload limit: 50MB per file.

## Startup Sequence
1. `file.init()` - Create required directories
2. `sql.init_db()` - Create database tables if not exist
3. `file.cycle_backup_db()` - Start 24h backup cycle
4. `user.fill_usernames_to_socket_ids()` - Load all non-purged usernames
5. `user.cycle_update_all(io)` - Start background sync cycle

## Middleware Stack (in order)
1. `express-fileupload` (50MB limit)
2. `express.static` - Serves frontend build from `{frontend}/build/`
3. Error handler (registered via `process.nextTick` - runs after deserialization): Destroys session and sends 401 on `deserializeUser` errors.
4. `express.urlencoded` - Parses URL-encoded bodies
5. `cookie-session` - Session cookie management
6. Rolling session middleware - Updates `req.session.nowInMinutes` on every request
7. `passport.initialize()`
8. `passport.session()`

## Passport Configuration
- `RedditStrategy` - Handles compatibility for different passport-reddit export formats
- Verify callback: Creates `User(username, refresh_token)`, calls `u.save()`, then calls `done(null, u)`
- `serializeUser`: Stores `u.username` in session
- `deserializeUser`: Calls `user.get(username)` to reconstruct User from DB

## Access Control (in `/callback`)
User is denied if any of these conditions is true:
1. All users allowed (`allowed_users` has `"*"`) AND user is explicitly denied
2. Not all users allowed AND user is not in the allowlist
3. All users denied (`denied_users` has `"*"`) AND user is not in the allowlist

Denied users have their data purged and are redirected to `/logout`.

## HTTP Routes

### `GET /login`
Initiates Reddit OAuth2 flow with `duration: "permanent"` for refresh tokens.

### `GET /callback`
OAuth2 callback handler. Checks user against allowed/denied lists. If denied, purges user data and redirects to `/logout`. If allowed, logs in via `req.login()` and redirects to `/`.

### `GET /get_users`
**No auth required.** Returns `{usernames, online_usernames}` - all non-purged usernames and which are currently online (have non-null socket IDs in `usernames_to_socket_ids`).

### `GET /authentication_check`
Checks if request is authenticated. If yes, maps `socket_id` (from query param) to username in both direction maps and returns `{username, use_page}` where `use_page` is `"access"` for returning users (have `last_updated_epoch`) or `"loading"` for new users. If not authenticated, returns `{use_page: "landing"}`.

### `POST /upload`
**Auth required.** Handles CSV file upload for Reddit data import. Accepts fields named: `saved_posts`, `saved_comments`, `posts`, `comments`, `post_votes`, `hidden_posts`. Calls `file.parse_import()` asynchronously (does not await) and immediately ends the response.

### `GET /download`
**Auth required.** Serves `tempfiles/{filename}.json` as a download and deletes the file afterward.

### `GET /logout`
**Auth required.** Calls `req.logout()` and redirects to `/`. Returns 401 if not authenticated.

### `DELETE /purge`
**Auth required + socket_id verification** (query param `socket_id` must match stored socket ID for the user). Calls `req.user.purge()`, then `req.logout()`. Returns `"success"` or `"error"`.

### `* (catch-all)`
Returns 404 with the SPA `index.html`.

## Socket.IO Events

### `"route"` (route)
Client notifies current route. Currently no-op (switch with empty cases for `"index"` and default).

### `"set view user"` (username)
Sets which user's data the socket is viewing. Leaves previous `view:{username}` room if any. Validates user exists via `user.get()`. Joins `view:{username}` room. Responds with `"view user set"` containing `{username, is_online, last_updated_epoch}` on success, or `{error: "user not found"}` on failure.

### `"page"` (page)
- `"landing"`: no-op
- `"loading"`: Sets `socket.auth_username` from `socket_ids_to_usernames`, calls `user.update(io, socket.id)` to trigger initial sync
- `"access"`: Sets `socket.auth_username`, emits `"store last updated epoch"` with user's current epoch, updates `last_active_epoch` in DB asynchronously

### `"get data"` (filter, item_count, offset)
Queries items for `socket.view_username` with the given filter. Emits `"got data"` with items and icon URLs.

### `"get placeholder"` (filter)
Returns item count for `socket.view_username` with given filter. Emits `"got placeholder"`.

### `"get subs"` (filter)
Returns distinct subreddits for `socket.view_username` with given filter. Emits `"got subs"`.

### `"renew comment"` (comment_id)
**Auth guard: `socket.auth_username` must equal `socket.view_username`.** Re-fetches comment body from Reddit API and emits `"renewed comment"` with new content.

### `"delete item from expanse acc"` (item_id, item_category)
**Auth guard.** Calls `sql.delete_item_from_expanse_acc()` asynchronously.

### `"delete item from reddit acc"` (item_id, item_category, item_type)
**Auth guard.** Calls `user.delete_item_from_reddit_acc()` asynchronously.

### `"export"`
**Auth guard.** Calls `file.create_export()`, emits `"download"` with the generated filename.

### `"disconnect"`
Cleans up socket mappings. Sets `usernames_to_socket_ids[username]` to `null` (not delete, because the key is needed in `update_all`). Deletes `socket_ids_to_usernames[socket.id]`.

## Socket Properties
- `socket.auth_username` - The Reddit-authenticated user (from session mapping, initialized to null)
- `socket.view_username` - The user whose data is being displayed (set by `"set view user"`, initialized to null)

## Server Shutdown
`process.on("beforeExit")` ends the PostgreSQL connection pool.
