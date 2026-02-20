# Expanse - Data Review Mode: Full Session Summary

## Table of Contents

1. [Overview](#1-overview)
2. [Original Plan: Data Review Mode](#2-original-plan-data-review-mode)
3. [Implementation Details](#3-implementation-details)
4. [Database Migration](#4-database-migration)
5. [Bug Fixes After Testing](#5-bug-fixes-after-testing)
6. [Push to Remote](#6-push-to-remote)
7. [Docker Deployment](#7-docker-deployment)
8. [Tech Stack](#8-tech-stack)
9. [Files Modified](#9-files-modified)
10. [Commit History](#10-commit-history)

---

## 1. Overview

The goal of this session was to add a **Data Review Mode** to Expanse, allowing any visitor to browse stored Reddit data for any user in the database **without requiring Reddit authentication**. Write operations (delete, renew, export, import, purge) remain gated behind authentication. Additionally, an existing PostgreSQL database was migrated from another server, and the application was prepared for Docker deployment.

---

## 2. Original Plan: Data Review Mode

### Concept

Allow unauthenticated visitors to select any non-purged user from a dropdown and browse their stored Reddit data (saved posts, comments, upvoted items, etc.) in read-only mode. Authenticated users retain full read-write access to their own data and can also browse other users' data in read-only mode.

### Key Principles

- **Read operations** (`get data`, `get placeholder`, `get subs`) use `socket.view_username` -- the user whose data is being displayed.
- **Write operations** (`renew comment`, `delete item from expanse acc`, `delete item from reddit acc`, `export`) are guarded: they only execute when `socket.auth_username === socket.view_username` and both are non-null.
- A new HTTP endpoint provides the list of available users without requiring authentication.
- The frontend shows online/offline status indicators for each user.

---

## 3. Implementation Details

### Backend (`backend/controller/server.mjs`)

#### New Endpoint: `GET /get_users`

Returns a list of non-purged usernames and which are currently online (have active socket connections). No authentication required.

```javascript
app.get("/get_users", async (req, res) => {
    try {
        const rows = await sql.get_all_non_purged_users();
        const usernames = rows.map(r => r.username);
        const online_usernames = usernames.filter(u => user.usernames_to_socket_ids[u]);
        res.send({ usernames, online_usernames });
    } catch (err) {
        console.error(err);
        res.send({ usernames: [], online_usernames: [] });
    }
});
```

#### New SQL Function: `get_all_non_purged_users()`

Added to `backend/model/sql.mjs`. Queries the `user_` table for users whose `reddit_api_refresh_token_encrypted` is not null (meaning they have not been purged).

```sql
SELECT username FROM user_ WHERE reddit_api_refresh_token_encrypted IS NOT NULL;
```

#### New Socket Event: `"set view user"`

Client sends a username. Server validates it exists in the database, sets `socket.view_username`, and responds with `"view user set"` including online status and last updated epoch.

```javascript
socket.on("set view user", async (username) => {
    try {
        const u = await user.get(username);
        socket.view_username = u.username;
        const is_online = !!user.usernames_to_socket_ids[u.username];
        io.to(socket.id).emit("view user set", {
            username: u.username,
            is_online,
            last_updated_epoch: u.last_updated_epoch
        });
    } catch (err) {
        console.error(err);
        io.to(socket.id).emit("view user set", { error: "user not found" });
    }
});
```

#### Renamed Socket Properties

On each new socket connection:
- `socket.auth_username` -- the Reddit-authenticated user (set from session mapping via `user.socket_ids_to_usernames`, may be null)
- `socket.view_username` -- the user whose data is being displayed (set by client via `"set view user"`)

Both initialized to `null` on connect.

#### Read Handlers Use `socket.view_username`

The `"get data"`, `"get placeholder"`, and `"get subs"` handlers all pass `socket.view_username` to their respective SQL functions.

#### Write Handlers Are Guarded

Each write handler checks authorization before proceeding:

```javascript
if (!socket.auth_username || socket.auth_username !== socket.view_username) return;
```

This applies to: `"renew comment"`, `"delete item from expanse acc"`, `"delete item from reddit acc"`, `"export"`.

#### Page and Disconnect Handlers Use `socket.auth_username`

The `"page"` handler for `"loading"` and `"access"` cases sets `socket.auth_username` from `user.socket_ids_to_usernames[socket.id]`. The `"disconnect"` handler cleans up using `socket.auth_username`.

### Frontend (`frontend/source/routes/index.svelte`)

#### Load Function Changes

Calls `/get_users` alongside `/authentication_check` using `Promise.all()`:

```javascript
const [auth_response, users_response] = await Promise.all([
    axios.get(`${globals_r.backend}/authentication_check?socket_id=${globals_r.socket.id}`),
    axios.get(`${globals_r.backend}/get_users`)
]);
```

Module-level variables (`_auth_username`, `_view_username`, `_available_users`, `_online_users`) are populated in `load()`, then copied to instance-level reactive variables in the `<script>` block.

#### Dispatch Handler

Handles the `"set view user"` action from child components to switch the active page to Access with the selected user:

```javascript
case "set view user":
    view_username = evt.detail.username;
    active_page = Access;
    break;
```

#### Props Passed to Children

All child components (`Landing`, `Loading`, `Access`) receive: `auth_username`, `view_username`, `available_users`, `online_users` via:

```svelte
<svelte:component this={active_page} on:dispatch={handle_component_dispatch}
    {auth_username} {view_username} {available_users} {online_users}/>
```

### Frontend (`frontend/source/components/landing.svelte`)

#### User Picker

When `available_users` is non-empty, shows a card with a dropdown listing all users with online/offline indicators and a "view" button:

```svelte
{#if available_users.length > 0}
    <div class="card bg-secondary mb-4 mx-auto" style="max-width: 400px;">
        <div class="card-body py-3">
            <p class="lead mb-2">browse stored data</p>
            <select bind:value={selected_user} ...>
                <option value="" disabled>select a user</option>
                {#each available_users as u}
                    <option value={u}>u/{u} {online_users.includes(u) ? 'online' : 'offline'}</option>
                {/each}
            </select>
            <button on:click={view_user} ...>view</button>
        </div>
    </div>
{/if}
```

#### View User Function

Dispatches immediately without waiting for a socket round-trip:

```javascript
function view_user() {
    if (!selected_user) return;
    dispatch("dispatch", { action: "set view user", username: selected_user });
}
```

### Frontend (`frontend/source/components/access.svelte`)

#### New Props

```javascript
export let auth_username;
export let view_username;
export let available_users;
export let online_users;

$: is_own_data = auth_username && auth_username === view_username;
```

#### User Picker in Access Page

Shows a dropdown with a "switch" button when there are multiple users or the visitor is not authenticated:

```svelte
{#if available_users.length > 1 || !auth_username}
    <select bind:value={selected_user} ...>
        {#each available_users as u}
            <option value={u}>u/{u} {online_users.includes(u) ? 'online' : 'offline'}</option>
        {/each}
    </select>
    <button on:click={switch_view_user} ...>switch</button>
{/if}
```

Note: Login buttons were intentionally removed from the access page. Login is only available on the landing page -- users log in on their own machines and everyone can browse stored data freely.

#### Viewing Indicator

```svelte
<span>viewing: <b>u/{view_username}</b>
    {#if !is_own_data} <small class="text-muted">(read-only)</small>{/if}
</span>
```

#### Conditional Write Buttons

The delete, renew, import, and export buttons are conditionally rendered based on `is_own_data`. The Navbar receives `show_data_anchors={is_own_data}`.

#### On Mount: Set View User Before Loading Data

```javascript
svelte.onMount(async () => {
    globals_r.socket.emit("page", "access");
    if (view_username) {
        await new Promise((resolve) => {
            globals_r.socket.emit("set view user", view_username);
            globals_r.socket.once("view user set", (data) => {
                if (!data.error && data.last_updated_epoch) {
                    last_updated_epoch = data.last_updated_epoch;
                }
                resolve();
            });
        });
    }
    // ... then refresh_item_list(), etc.
});
```

#### Switch View User (Within Access)

Handles user switching entirely within the Access component to avoid the Svelte component reuse issue:

```javascript
function switch_view_user() {
    if (!selected_user || selected_user === view_username) return;
    globals_r.socket.emit("set view user", selected_user);
    globals_r.socket.once("view user set", async (data) => {
        if (!data.error) {
            view_username = data.username;
            if (data.last_updated_epoch) {
                last_updated_epoch = data.last_updated_epoch;
            }
            await refresh_item_list();
            update_search_placeholder();
            fill_subreddit_select();
        }
    });
}
```

### Frontend (`frontend/source/components/navbar.svelte`)

- Renamed `username` prop to `auth_username`
- Added `show_data_anchors` prop to control visibility of import/export anchors
- When not authenticated, the navbar shows nothing extra (no login button -- login is landing-page only)
- When authenticated, existing behavior unchanged (username, settings dropdown, import/export/purge)

### Frontend (`frontend/source/components/loading.svelte`)

- Renamed `username` prop to `auth_username` for consistency with the other components

---

## 4. Database Migration

### Context

The user had an existing Expanse installation on another server with a PostgreSQL database that needed to be migrated to the local development environment.

### Attempt 1: Custom Format Dump (Failed)

- File: `expanse_backup.dump` (PostgreSQL custom format, v1.14-0)
- Size: 2.6MB, valid PGDMP header
- Failed with: `"could not read from input file: end of file"` despite re-transferring the file
- Root cause: Likely corruption during transfer or incompatible pg_dump/pg_restore versions

### Attempt 2: Plain SQL (Succeeded)

- File: `expanse_backup.sql` (7.6MB, plain SQL format)
- Restore command:
  ```bash
  PGPASSWORD=pg psql -h localhost -p 5432 -U pg -d db -f expanse_backup.sql
  ```
- Result:
  - 20,515 items
  - 1,425 sub icon URLs
  - 11 users
  - 30,795 user-item mappings
- "Already exists" errors were harmless -- tables existed from prior server start, data loaded via COPY statements

### Encryption Key Mismatch

After restoring, the backend showed `Error: Unsupported state or unable to authenticate data` for all 11 users during the auto-sync cycle. This is because:

- Reddit API refresh tokens are encrypted with `Cryptr` using the `ENCRYPTION_KEY` from the source server's `.env`
- The local `.env` has a different `ENCRYPTION_KEY`
- Decryption fails for all stored tokens

**Impact:**
- Data browsing works fine (stored items are plain text in the database)
- Auto-sync with Reddit fails (tokens cannot be decrypted)
- Users would need to re-authenticate via Reddit OAuth to get new tokens encrypted with the new key

### Dev Table Drop Fix (`backend/model/sql.mjs`)

The `init_db()` function originally dropped all tables when `RUN=dev`, which would wipe restored data on every backend restart in development mode.

**Before:**
```javascript
if (process.env.RUN == "dev") {
    // drops all tables
}
```

**After:**
```javascript
if (process.env.RUN == "dev" && process.env.DEV_DROP_TABLES == "true") {
    // drops all tables only when explicitly requested
}
```

This adds a safety gate: tables are only dropped in dev mode when `DEV_DROP_TABLES=true` is explicitly set in the environment.

---

## 5. Bug Fixes After Testing

### Bug 1: Vite Proxy Target

- **Problem**: Frontend Vite dev server proxy pointed to `host.docker.internal` which does not resolve outside Docker
- **Error**: `Error: getaddrinfo ENOTFOUND host.docker.internal`
- **File**: `frontend/vite.config.js`
- **Fix**: Changed proxy target from `http://host.docker.internal:...` to `http://localhost:...`

```javascript
// Before
target: `http://host.docker.internal:${Number.parseInt(process.env.PORT)+1}`,

// After
target: `http://localhost:${Number.parseInt(process.env.PORT)+1}`,
```

### Bug 2: Svelte Reactivity -- Module-Level Variables

- **Problem**: `auth_username`, `view_username`, `available_users`, `online_users` were declared in `<script context="module">` in `index.svelte`. Module-level variables are NOT reactive in Svelte -- changes to them do not trigger re-renders of child components.
- **File**: `frontend/source/routes/index.svelte`
- **Fix**: Kept module-level versions prefixed with underscore (`_auth_username`, etc.) for use in the `load()` function (which runs in module scope), and copied them into instance-level reactive variables in the `<script>` block:

```javascript
// Module scope (for load())
let _auth_username = null;
let _view_username = null;
let _available_users = [];
let _online_users = [];

// Instance scope (reactive)
let auth_username = _auth_username;
let view_username = _view_username;
let available_users = _available_users;
let online_users = _online_users;
```

### Bug 3: User Switch Button Not Working (Landing to Access)

- **Problem**: The `view_user()` function in `landing.svelte` originally waited for a socket round-trip (`"set view user"` then `"view user set"`) before dispatching to the parent. This added unnecessary latency and potential failure points.
- **File**: `frontend/source/components/landing.svelte`
- **Fix**: Dispatch immediately without waiting for socket confirmation. The Access component handles the `"set view user"` socket event on mount:

```javascript
// Before (waited for socket round-trip)
function view_user() {
    if (!selected_user) return;
    globals_r.socket.emit("set view user", selected_user);
    globals_r.socket.once("view user set", (data) => {
        if (!data.error) {
            dispatch("dispatch", { action: "set view user", username: data.username });
        }
    });
}

// After (dispatch immediately)
function view_user() {
    if (!selected_user) return;
    dispatch("dispatch", { action: "set view user", username: selected_user });
}
```

### Bug 4: User Switch Within Access Page

- **Problem**: `switch_view_user()` dispatched to the parent which set `active_page = Access`. Since the page was already Access, Svelte reused the existing component instance. `onMount` did not re-fire, so data was never refreshed for the new user.
- **File**: `frontend/source/components/access.svelte`
- **Fix**: Handle switching entirely within the Access component. Update `view_username` locally and call `refresh_item_list()` directly:

```javascript
function switch_view_user() {
    if (!selected_user || selected_user === view_username) return;
    globals_r.socket.emit("set view user", selected_user);
    globals_r.socket.once("view user set", async (data) => {
        if (!data.error) {
            view_username = data.username;
            if (data.last_updated_epoch) {
                last_updated_epoch = data.last_updated_epoch;
            }
            try {
                await refresh_item_list();
                update_search_placeholder().catch((err) => console.error(err));
                fill_subreddit_select().catch((err) => console.error(err));
            } catch (err) {
                console.error(err);
            }
        }
    });
}
```

### Bug 5: Race Condition -- Data Loading Before View User Set

- **Problem**: On initial Access mount, `"set view user"` and `"get data"` (from `refresh_item_list()`) were emitted in quick succession. The backend's `"set view user"` handler is async (performs a DB query), so `"get data"` could be processed before `socket.view_username` was set, resulting in a null username being passed to SQL queries.
- **File**: `frontend/source/components/access.svelte`
- **Fix**: Wrap the `"set view user"` socket emit in a Promise and await it before loading data:

```javascript
svelte.onMount(async () => {
    globals_r.socket.emit("page", "access");

    if (view_username) {
        await new Promise((resolve) => {
            globals_r.socket.emit("set view user", view_username);
            globals_r.socket.once("view user set", (data) => {
                if (!data.error && data.last_updated_epoch) {
                    last_updated_epoch = data.last_updated_epoch;
                }
                resolve();
            });
        });
    }

    // Now safe to call refresh_item_list()
    try {
        await refresh_item_list();
        hide_skeleton_loading();
        // ...
    } catch (err) {
        console.error(err);
    }
});
```

---

## 6. Push to Remote

A new remote was added and three commits were pushed:

```bash
git remote add rivaborn https://github.com/rivaborn/expanse.git
git push rivaborn main
```

### Commits Pushed

1. `948075d` -- Fix local dev setup: use env vars for DB connection and fix npm scripts
2. `88b1bd3` -- Add data review mode: allow browsing stored data without authentication
3. `dc77a60` -- Fix data review mode: reactivity, race conditions, and local dev proxy
4. `bd19d9f` -- Remove login buttons from access page and navbar

---

## 7. Docker Deployment

### Dockerfile Overview (`dockerfile`)

Multi-stage build with three stages:

- **Stage 0** (Node 18): Installs backend dependencies via `npm ci`, copies backend source
- **Stage 1** (Node 18): Installs frontend dependencies via `npm ci`, copies frontend source, runs `npm run build`
- **Stage 2** (Ubuntu 22.04): Runtime image with Node 18 (via NodeSource), `postgresql-client-14`, `wait-for-it`, and `concurrently`. Copies built backend from Stage 0 and built frontend from Stage 1.

### Docker Compose (`compose.prod.yaml`)

Two services:

- **db**: PostgreSQL 14, data persisted in a Docker volume, env from `backend/.env_prod`
- **app**: Depends on `db`, exposes port `1301`, uses `wait-for-it` to wait for DB before starting, runs `npm run prod`

### Deploy Steps on a New System

1. Clone the repository:
   ```bash
   git clone https://github.com/rivaborn/expanse.git && cd expanse
   ```

2. Create `backend/.env_prod` with required variables:
   - `DB_HOST=db`
   - `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`
   - `REDDIT_APP_ID`, `REDDIT_APP_SECRET`, `REDDIT_APP_REDIRECT`
   - `SESSION_SECRET`, `ENCRYPTION_KEY`
   - `ALLOWED_USERS`, `DENIED_USERS`
   - `PORT=1301`
   - `RUN=prod`

3. Update `compose.prod.yaml`:
   - Replace the `image:` directive with `build: ./` (to build from the local Dockerfile)
   - Optionally remove the exposed DB port (`5432:5432`) for security

4. Build and run:
   ```bash
   docker compose -f compose.prod.yaml build
   docker compose -f compose.prod.yaml up -d
   ```

5. Application available at `http://<server>:1301`

6. To update to the latest version:
   ```bash
   ./run.sh prod update
   ```
   This runs: down → `git pull` → pull base images → **rebuild app image** → up

---

## 8. Tech Stack

| Layer          | Technology                                      |
|----------------|------------------------------------------------|
| Frontend       | Svelte (SvelteKit with Vite)                   |
| Backend        | Node.js with Express, Socket.IO, Passport      |
| Database       | PostgreSQL 14                                   |
| Auth           | Passport.js with Reddit OAuth2 strategy         |
| Encryption     | Cryptr (for Reddit refresh tokens)              |
| Real-time      | Socket.IO (bidirectional events)                |
| Deployment     | Docker Compose (multi-stage Dockerfile)         |
| Search         | PostgreSQL full-text search (`tsvector`)        |

---

## 9. Files Modified

| File | Description |
|------|-------------|
| `backend/controller/server.mjs` | New `/get_users` endpoint, `"set view user"` socket event, renamed socket properties, write handler guards |
| `backend/model/sql.mjs` | New `get_all_non_purged_users()` function, dev table drop safety gate (`DEV_DROP_TABLES`) |
| `frontend/source/routes/index.svelte` | Dual API calls in `load()`, module-to-instance variable bridging, `"set view user"` dispatch handler |
| `frontend/source/components/landing.svelte` | User picker dropdown with online status, immediate dispatch on view |
| `frontend/source/components/access.svelte` | `auth_username`/`view_username` props, `is_own_data` reactive flag, user switcher, awaited `"set view user"` on mount, conditional write buttons, removed login button |
| `run.sh` | Added `docker compose build` step to `prod update` command |
| `frontend/source/components/navbar.svelte` | Renamed `username` to `auth_username`, added `show_data_anchors` prop, removed login button (login is landing-page only) |
| `frontend/source/components/loading.svelte` | Renamed `username` prop to `auth_username` |
| `frontend/vite.config.js` | Changed proxy target from `host.docker.internal` to `localhost` |

---

## 10. Commit History

| Hash | Message |
|------|---------|
| `948075d` | Fix local dev setup: use env vars for DB connection and fix npm scripts |
| `88b1bd3` | Add data review mode: allow browsing stored data without authentication |
| `dc77a60` | Fix data review mode: reactivity, race conditions, and local dev proxy |
| `bd19d9f` | Remove login buttons from access page and navbar |

All four commits were pushed to `https://github.com/rivaborn/expanse.git` on the `main` branch.
