# server.mjs - Main Server Entry Point

## Overview
The main server file that sets up Express HTTP server, Socket.IO real-time communication, Passport.js Reddit OAuth2 authentication, and all route/event handlers. This is the application's entry point.

## Imports
- `socket.io` - WebSocket server for real-time bidirectional communication
- `express` - HTTP framework
- `cookie-session` - Session management via signed cookies
- `passport` / `passport-reddit` - Reddit OAuth2 authentication strategy
- `crypto` - Node.js crypto (available but not actively used)
- `fs` - File system operations (for temp file cleanup)
- `express-fileupload` - Multipart file upload handling
- Internal modules: `file`, `sql`, `user`, `utils`

## Configuration
- `allowed_users` (Set) - Usernames allowed to use the app (from `ALLOWED_USERS` env var). `"*"` means all users allowed.
- `denied_users` (Set) - Usernames explicitly denied (from `DENIED_USERS` env var). `"*"` means all users denied.
- Socket.IO `maxHttpBufferSize`: 1MB
- Cookie session: 30-day expiry, httpOnly, sameSite: "lax", rolling expiry

## Startup Sequence
1. `file.init()` - Create required directories
2. `sql.init_db()` - Create database tables if not exist
3. `file.cycle_backup_db()` - Start 24h backup cycle
4. `user.fill_usernames_to_socket_ids()` - Load all non-purged usernames
5. `user.cycle_update_all(io)` - Start background sync cycle

## HTTP Routes

### `GET /login`
Initiates Reddit OAuth2 flow with `duration: "permanent"` for refresh tokens.

### `GET /callback`
OAuth2 callback handler. Checks user against allowed/denied lists. If denied, purges user data. If allowed, logs in and redirects to `/`.

### `GET /get_users`
**No auth required.** Returns all non-purged usernames and which are currently online (have active socket connections). Used for data review mode.

### `GET /authentication_check`
Checks if request is authenticated. If yes, maps socket_id to username and returns `use_page` ("access" for returning users, "loading" for new users). If not authenticated, returns `use_page: "landing"`.

### `POST /upload`
**Auth required.** Handles CSV file upload for Reddit data import. Accepts: saved_posts, saved_comments, posts, comments, post_votes, hidden_posts.

### `GET /download`
**Auth required.** Serves JSON export file and deletes it after download.

### `GET /logout`
Destroys session and redirects to `/`.

### `DELETE /purge`
**Auth required + socket_id verification.** Purges all user data from database.

### `* (catch-all)`
Returns 404 with the SPA index.html.

## Socket.IO Events

### `"route"` (route)
Client notifies current route. Currently no-op (switch with empty cases).

### `"set view user"` (username)
Sets which user's data the socket is viewing. Leaves previous view room, validates user exists, joins `view:<username>` room. Responds with `"view user set"` containing username, online status, and last_updated_epoch.

### `"page"` (page)
- `"landing"`: no-op
- `"loading"`: Sets `socket.auth_username`, triggers initial data sync via `user.update(io, socket_id)`
- `"access"`: Sets `socket.auth_username`, sends last_updated_epoch, updates last_active_epoch

### `"get data"` (filter, item_count, offset)
Queries items for `socket.view_username` with the given filter. Returns items and icon URLs.

### `"get placeholder"` (filter)
Returns item count for `socket.view_username` with given filter.

### `"get subs"` (filter)
Returns distinct subreddits for `socket.view_username` with given filter.

### `"renew comment"` (comment_id)
**Auth guard: `socket.auth_username === socket.view_username`.** Re-fetches comment body from Reddit API.

### `"delete item from expanse acc"` (item_id, item_category)
**Auth guard.** Deletes item from Expanse database only.

### `"delete item from reddit acc"` (item_id, item_category, item_type)
**Auth guard.** Deletes item from Reddit account (unsave/delete/unvote/unhide).

### `"export"`
**Auth guard.** Creates JSON export file and sends download link.

### `"disconnect"`
Cleans up socket-to-username mappings. Sets `usernames_to_socket_ids[username]` to null (not delete, because username is needed in update_all).

## Socket Properties
- `socket.auth_username` - The Reddit-authenticated user (from session mapping, may be null)
- `socket.view_username` - The user whose data is being displayed (set by `"set view user"`)
