# index.svelte - Main Page Router

## Overview
The main page component that handles authentication checking, user listing, and routing between Landing, Loading, and Access pages. Acts as the top-level controller for the SPA.

## Module Scope
Imports: `globals`, `Landing`, `Loading`, `Access`, `svelte`, `axios`. Reads `globals.readonly` into `globals_r`.

### Module-level Variables
- `_auth_username` (string|null) - Authenticated user's Reddit username. Set in `load()`.
- `_view_username` (string|null) - Username being viewed. Defaults to `_auth_username`.
- `_available_users` (array) - All non-purged usernames from database. Set in `load()`.
- `_online_users` (array) - Usernames currently online/syncing. Set in `load()`.

**Note:** These `_` prefixed module-level variables are NOT reactive in Svelte. They are used only to pass initial values to instance-level reactive variables.

### `load(obj)` (SvelteKit load function)
Makes two parallel requests via `Promise.all`:
1. `GET /authentication_check?socket_id={globals_r.socket.id}` - Returns `{username, use_page}` (or `{use_page: "landing"}` if unauthenticated)
2. `GET /get_users` - Returns `{usernames, online_usernames}`

Sets the four module-level `_` variables and returns `{status: 200, props: {use_page}}`.

Error handling:
- If error message ends with `401`: backend `deserializeUser` failure, returns `{status: 401}`
- Otherwise: request failure, returns `{status: 503}`

## Instance Scope

### Props
- `use_page` (string) - `"landing"`, `"loading"`, or `"access"` — determines initial page

### Variables
- `active_page` (Svelte Component) - Currently rendered page component. Set by initial switch and `handle_component_dispatch`.
- `auth_username` (string|null) - Reactive copy of `_auth_username`
- `view_username` (string|null) - Reactive copy of `_view_username`
- `available_users` (array) - Reactive copy of `_available_users`
- `online_users` (array) - Reactive copy of `_online_users`

### `handle_component_dispatch(evt)`
Handles `"dispatch"` events from child components. Reads `evt.detail.action || evt.detail` (handles both object and string payloads):
- `"switch page to loading"` → sets `active_page = Loading`
- `"switch page to access"` → sets `active_page = Access`
- `"set view user"` → sets `view_username = evt.detail.username`, sets `active_page = Access`

### Initial page routing (runs at instance creation, not in lifecycle hooks)
Switch on `use_page`: sets `active_page` to `Landing`, `Loading`, or `Access`.

### `onMount`
- If `window.location.href` ends with `"/#_"` (Reddit OAuth callback artifact): calls `window.history.pushState` to strip it
- Emits `"route" "index"` socket event

## Template
- `<svelte:head>`: sets `<title>` to `globals_r.app_name`, meta description to `globals_r.description`
- `<svelte:component this={active_page}>`: dynamically renders the active page, passing `on:dispatch`, `auth_username`, `view_username`, `available_users`, `online_users` as props
