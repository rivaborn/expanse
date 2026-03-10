# landing.svelte - Landing Page

## Overview
The landing/home page shown to unauthenticated visitors. Displays the app description, a user browser dropdown (when data is available), a demo video, Reddit OAuth scope information, and a login button.

## Module Scope
Imports: `globals`, `Navbar`, `svelte`. Reads `globals.readonly` into `globals_r`.

## Instance Scope

### Props
- `auth_username` (string|null) - Authenticated username (passed to Navbar; typically null on the landing page)
- `available_users` (array) - List of all non-purged usernames to show in the browse dropdown
- `online_users` (array) - List of currently syncing usernames (used to show "(syncing)" label)

### Variables
- `selected_user` (string) - Currently selected username in the browse dropdown. Initialized to `""`.
- `dispatch` - Svelte event dispatcher created via `svelte.createEventDispatcher()`

### `view_user()`
Guards against empty selection. Dispatches a `"dispatch"` event to the parent (index.svelte) with payload `{action: "set view user", username: selected_user}`. This triggers navigation to the Access page with that user's data. Socket communication is handled by the Access page, not here.

### `onMount`
Emits `"page" "landing"` socket event (no-op on server).

## Template
- `<Navbar>` component with `auth_username`
- Jumbotron with:
  - App name heading
  - Description text (from `globals_r.description`)
  - Features list (sync, deletion-resistance, search, filter, CSV import, JSON export)
  - **User picker card** (shown when `available_users.length > 0`): `<select>` bound to `selected_user`, lists each user as `u/{username}` with optional `(syncing)` label; "view" button disabled when no user is selected
  - Horizontal rule
  - Embedded YouTube demo iframe (video ID: `4pxXM98ewIc`)
  - Horizontal rule
  - Reddit OAuth2 scope list with links (identity, history, read, save, edit, vote, report)
  - "log in with Reddit" button linking to `{globals_r.backend}/login` with `rel="external"`
