# navbar.svelte - Navigation Bar

## Overview
Navigation bar component with user profile display and settings dropdown (import, export, purge). Only shown for authenticated users viewing their own data.

## Instance Scope

### Props
- `auth_username` (string|null) - Authenticated username. If null, navbar shows nothing.
- `show_data_anchors` (boolean|undefined) - Whether to show import/export links. True when user is viewing their own data.

### Variables
DOM references for: settings_btn, settings_menu, import_anchor, import_notice, files_input, selected_files_list, import_cancel_btn, import_confirm_btn, export_anchor, dl (hidden download link), purge_anchor, purge_warning, purge_input, purge_cancel_btn, purge_confirm_btn, purge_spinner_container, redirect_notice, redirect_countdown_wrapper, modal

### Functions

#### `toggle_import_notice()` / `hide_import_notice()` / `reset_import_notice()`
Manage the import data panel visibility and state. Reset clears file input and selected files list.

#### `toggle_purge_warning()` / `hide_purge_warning()`
Manage the purge confirmation panel visibility. Reset clears the confirmation input.

#### `purge()`
Sends `DELETE /purge` request. On success: shows redirect notice with 10-second countdown, then reloads page.

### `onMount`
Sets up event listeners:
- Settings button: blur on close, hide purge/import panels
- Settings menu: stop click propagation (keep dropdown open)
- Purge anchor: toggle purge warning, hide import
- Purge cancel/confirm: toggle warning, validate confirmation text ("purge u/{username}")
- Purge input: Enter key triggers confirm
- Import anchor: toggle import notice, hide purge
- Import cancel/confirm: validate file selection, upload via XMLHttpRequest, show modal on success
- File input: validate filenames (allowed CSV files only) and sizes (50MB limit)
- Export anchor: emit "export" socket event, wait for "download" response, trigger download

## Template
- When authenticated: shows "u/{username}" link to Reddit profile, settings gear dropdown
  - Dropdown menu: logout link, import data (when show_data_anchors), export data (when show_data_anchors), purge account
  - Import panel: instructions, file picker, file list, cancel/confirm buttons
  - Purge panel: warning text, confirmation input, cancel/confirm buttons, spinner, redirect notice
- Import success modal: "import started" notification
