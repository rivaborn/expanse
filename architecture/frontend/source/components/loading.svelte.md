# loading.svelte - Loading/Sync Progress Page

## Overview
Displayed during initial data sync for new or returning users. Shows a spinner with progress percentage.

## Instance Scope

### Props
- `auth_username` (string) - Authenticated username (passed to Navbar)

### Variables
- `progress_wrapper` (HTMLElement) - DOM reference to progress percentage display

### `onMount`
1. Emits `"page" "loading"` socket event (triggers server-side `user.update()`)
2. Listens for `"update progress"` events: updates percentage display
3. When progress reaches 100%: waits 2 seconds then dispatches `"switch page to access"` to parent

### `onDestroy`
Removes `"update progress"` socket listener.

## Template
- Navbar component
- App name heading
- Bootstrap spinner with percentage text
