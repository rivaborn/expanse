# __error.svelte - Error Page Component

## Overview
SvelteKit error page displayed for HTTP errors. Shows the error status code and a "return to app" link. For 404 errors, makes a backend request to confirm the actual status.

## Module Scope
Imports: `globals`, `svelte`, `axios`. Reads `globals.readonly` into `globals_r`.

### `ensure_redirect(current_path)`
If the current path is `"/"`, pushes `"/error"` to history so that the "return to app" link navigates back to index properly (otherwise the link would be a no-op since we're already at `/`).

### `load(obj)` (SvelteKit load function)
Receives `{status, error, url}` from SvelteKit. Logs status and error message.
- **Non-404 errors**: Calls `ensure_redirect()`, returns `{props: {http_status: obj.status}}`.
- **404 errors**: Makes a `GET` request to `globals_r.backend + obj.url.pathname` via axios (expected to throw since backend returns 404). Parses the error status from the error message (last word). Calls `ensure_redirect()`, returns `{props: {http_status: parsed_status}}`.

## Instance Scope

### Props
- `http_status` (number) - The HTTP error status code to display

### `onMount`
Emits `"route"` socket event with `http_status` as the payload.

## Template
- `<svelte:head>`: sets page `<title>` and meta description to the HTTP status code
- Centered `<div>`: large display of `http_status` (as a link to Google search for that code), and "return to app" link pointing to `"/"`
