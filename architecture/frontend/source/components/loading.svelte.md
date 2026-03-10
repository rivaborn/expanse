# loading.svelte - Loading/Sync Progress Page

## Overview
Displayed during the initial data sync for new users. Shows a Bootstrap spinner alongside a progress percentage. When sync completes (100%), automatically navigates to the Access page.

## Module Scope
Imports: `globals`, `Navbar`, `svelte`. Reads `globals.readonly` into `globals_r`.

## Instance Scope

### Props
- `auth_username` (string) - Authenticated username (passed to Navbar)

### Variables
- `progress_wrapper` (HTMLElement|null) - DOM reference to the percentage display element. Bound via `bind:this`.
- `dispatch` - Svelte event dispatcher created via `svelte.createEventDispatcher()`

### `onMount`
1. Emits `"page" "loading"` socket event. This triggers the server-side `user.update(io, socket_id)` call.
2. Registers listener for `"update progress"` socket event:
   - Receives `(progress, complete)` integers
   - Computes `progress_percentage = progress/complete * 100`
   - Updates `progress_wrapper.innerHTML` with `Math.floor(progress_percentage)`
   - When percentage reaches 100: waits 2 seconds then dispatches `"switch page to access"` to parent (index.svelte)

### `onDestroy`
Removes the `"update progress"` socket listener.

## Template
- `<Navbar>` component with `auth_username`
- App name `<h1>`
- `#loading_container`: Bootstrap spinner (`spinner-border`) overlaid with percentage text (`<span bind:this={progress_wrapper}>?</span>%`) using negative margin to position the text within the spinner
