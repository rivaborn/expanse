# __error.svelte - Error Page Component

## Overview
Displays HTTP error status codes with a link to search for the error and a "return to app" link.

## Module Scope

### `ensure_redirect(current_path)`
If the current path is `/`, pushes `/error` to history so that "return to app" link will actually navigate back to index.

### `load(obj)` (SvelteKit load function)
For non-404 errors: uses the status directly. For 404 errors: makes a request to the backend path to get the actual error status code. Returns `http_status` as a prop.

## Instance Scope

### Props
- `http_status` (number) - The HTTP error status code to display

### `onMount`
Emits `"route"` socket event with the HTTP status.

## Template
- Large display of the HTTP status code (links to Google search for that status)
- "return to app" link pointing to `/`
