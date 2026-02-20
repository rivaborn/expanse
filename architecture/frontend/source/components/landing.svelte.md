# landing.svelte - Landing Page

## Overview
The landing/home page shown to unauthenticated visitors. Displays app description, user browser dropdown, demo video, OAuth scope information, and login button.

## Module Scope
Imports globals, Navbar component, and svelte utilities.

## Instance Scope

### Props
- `auth_username` (string|null) - Authenticated username (passed to Navbar)
- `available_users` (array) - List of non-purged usernames to show in dropdown
- `online_users` (array) - List of currently syncing usernames

### Variables
- `selected_user` (string) - Currently selected username in dropdown

### `view_user()`
Dispatches `"set view user"` event with the selected username to the parent (index.svelte). This triggers navigation to the Access page with that user's data. No socket event is emitted here - the Access page handles the socket communication.

### `onMount`
Emits `"page" "landing"` socket event.

## Template
- Navbar component
- App name and description
- Features list
- **User picker** (shown when `available_users.length > 0`): Bootstrap card with dropdown of users, online users marked with "(syncing)", and "view" button
- Embedded YouTube demo video
- Reddit OAuth scope documentation list
- "log in with Reddit" button linking to `{backend}/login`
