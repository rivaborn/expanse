# __layout.svelte - Root Layout Component

## Overview
SvelteKit root layout that wraps all pages. Waits for the Socket.IO connection to establish before allowing child pages to render. Provides the responsive container and footer.

## Module Scope
Imports: `globals`. Reads `globals.readonly` into `globals_r`.

### `load(obj)` (SvelteKit load function)
Waits up to 5 seconds for `globals_r.socket.connected` to become true, polling every 100ms via `setInterval`. On success: returns `{status: 200}`. On timeout (5000ms): clears interval, logs the timeout error, returns `{status: 408}`.

## Template
- Responsive Bootstrap fluid container: `<div class="container-fluid text-light">` wrapping a centered row
- Content column: `col-12` on xs, narrowing to `col-8` on xl screens via Bootstrap grid classes
- `<slot/>` - renders the current child page
- Footer: centered GitHub icon link using `globals_r.repo` as the href
