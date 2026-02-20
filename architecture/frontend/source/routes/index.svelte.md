# index.svelte - Main Page Router

## Overview
The main page component that handles authentication checking, user listing, and routing between Landing, Loading, and Access pages.

## Module Scope

### Variables
- `_auth_username` (string|null) - Authenticated user's Reddit username (module-level, set in load)
- `_view_username` (string|null) - Username being viewed (module-level, defaults to auth_username)
- `_available_users` (array) - All non-purged usernames from database
- `_online_users` (array) - Usernames currently syncing (have active socket connections)

**Note:** Module-level variables prefixed with `_` are NOT reactive in Svelte. They're copied to instance-level reactive variables.

### `load(obj)` (SvelteKit load function)
Makes two parallel requests:
1. `GET /authentication_check?socket_id=...` - Returns auth status and which page to show
2. `GET /get_users` - Returns available usernames and online usernames

Sets module-level variables and returns `use_page` prop.

Error handling: 401 → backend deserialize error, 503 → request failed.

## Instance Scope

### Props
- `use_page` (string) - "landing", "loading", or "access"

### Variables
- `active_page` (Component) - Currently active Svelte component
- `auth_username` (string|null) - Reactive copy of `_auth_username`
- `view_username` (string|null) - Reactive copy of `_view_username`
- `available_users` (array) - Reactive copy of `_available_users`
- `online_users` (array) - Reactive copy of `_online_users`

### `handle_component_dispatch(evt)`
Handles dispatch events from child components:
- `"switch page to loading"` → sets active_page to Loading
- `"switch page to access"` → sets active_page to Access
- `"set view user"` → sets view_username and switches to Access

### `onMount`
Cleans up Reddit OAuth callback URL hash (`/#_`). Emits `"route" "index"` socket event.

## Template
Uses `<svelte:component>` to dynamically render the active page, passing all props.
