# __layout.svelte - Root Layout Component

## Overview
SvelteKit root layout that wraps all pages. Waits for Socket.IO connection before rendering content.

## Module Scope

### `load(obj)` (SvelteKit load function)
Waits up to 5 seconds for the Socket.IO connection to establish. Polls every 100ms. Returns status 200 on success, 408 on timeout.

## Template
- Responsive Bootstrap container: full width on xs, progressively narrower on larger screens (col-12 → col-8 on xl)
- Renders child page via `<slot/>`
- Footer with GitHub repo link icon
