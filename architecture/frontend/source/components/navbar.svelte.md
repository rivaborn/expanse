# navbar.svelte - Navigation Bar

## Overview
Navigation bar component with user profile display and a settings dropdown containing import, export, and purge account functionality. Only renders user-specific controls when `auth_username` is provided. Import and export links are conditionally shown based on `show_data_anchors`.

## Module Scope
Imports: `globals`, `utils`, `svelte`. Reads `globals.readonly` into `globals_r`.

## Instance Scope

### Props
- `auth_username` (string|null) - Authenticated username. If null or falsy, the entire auth section is hidden.
- `show_data_anchors` (boolean|undefined) - Whether to show import/export links. True when the user is viewing their own data.

### Variables
DOM references (all destructured from an array initialized to `[]`):
`settings_btn`, `settings_menu`, `import_anchor`, `import_notice`, `files_input`, `selected_files_list`, `import_cancel_btn`, `import_confirm_btn`, `export_anchor`, `dl` (hidden download anchor), `purge_anchor`, `purge_warning`, `purge_input`, `purge_cancel_btn`, `purge_confirm_btn`, `purge_spinner_container`, `redirect_notice`, `redirect_countdown_wrapper`, `modal`

### Functions

#### `toggle_import_notice()`
Calls `reset_import_notice()` then toggles `d-none` on `import_notice`.

#### `hide_import_notice()`
Calls `reset_import_notice()` then adds `d-none` to `import_notice` if not already hidden.

#### `reset_import_notice()`
Clears `files_input.files` (by assigning a new empty DataTransfer's file list) and clears `selected_files_list.innerHTML`.

#### `toggle_purge_warning()`
Clears `purge_input.value` and toggles `d-none` on `purge_warning`.

#### `hide_purge_warning()`
Clears `purge_input.value` and adds `d-none` to `purge_warning` if not already hidden.

#### `purge()`
Calls `toggle_purge_warning()` and `purge_spinner_container.classList.toggle("d-none")`. Sends `DELETE /purge?socket_id={globals_r.socket.id}` via `fetch`. On `"success"` response: schedules `window.location.reload()` in 10 seconds, shows `redirect_notice`, hides spinner, starts 1-second countdown interval updating `redirect_countdown_wrapper`. Logs errors on failure.

### `onMount`
Early return if `!auth_username`. Sets up event listeners:
- **Settings button** click (delayed 100ms): if menu is not open, blurs button and hides purge warning and import notice (if `show_data_anchors`)
- **Settings menu** click: `stopPropagation()` to prevent dropdown from closing
- **Purge anchor** click: prevents default, toggles purge warning, hides import notice (if `show_data_anchors`)
- **Purge cancel button** click: prevents default, toggles purge warning
- **Purge confirm button** click: prevents default, validates `purge_input.value == "purge u/{auth_username}"`, calls `purge()` or shakes input
- **Purge input** keydown: Enter key triggers same validation as confirm button

Early return if `!show_data_anchors` before setting up import/export listeners:
- **Import anchor** click: hides purge warning, toggles import notice
- **Import cancel** click: toggles import notice
- **Import confirm** click: validates at least one file is selected, shows preparing message, builds FormData (key = filename without extension), sends via XMLHttpRequest POST to `/upload`, shows modal (`jQuery(modal).modal("show")`) when `readyState == 4 && status == 200`
- **File input** change: iterates selected files, validates each filename against allowed list (`saved_posts.csv`, `saved_comments.csv`, `posts.csv`, `comments.csv`, `post_votes.csv`, `hidden_posts.csv`), validates size <= 50MB. Shows error and resets on invalid file.
- **Export anchor** click: emits `"export"` socket event, awaits `"download"` response, sets `dl.href` and programmatically clicks `dl` to trigger browser download

## Template
- `<nav>` with `mt-5 px-5`:
  - When `auth_username`: float-right span with `u/{auth_username}` link to Reddit profile, settings dropdown button (`fa-cog`), settings dropdown menu containing:
    - Logout link (`{globals_r.backend}/logout`)
    - Divider
    - When `show_data_anchors`: import data anchor, import notice panel (instructions + file picker + file list + cancel/confirm buttons), divider, export data anchor, hidden download anchor, divider
    - Purge account anchor, purge warning panel (text + confirmation input + cancel/confirm), purge spinner, redirect notice
  - Clearfix
- When `show_data_anchors`: Bootstrap modal with "IMPORT STARTED" message (shown when upload completes)
