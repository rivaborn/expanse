# vite.config.js - Vite/SvelteKit Build Configuration

## Overview
Configures the Vite development server and SvelteKit plugin.

## Configuration

### `plugins`
- `sveltekit()` - SvelteKit Vite plugin

### `resolve.alias`
- `frontend` → current working directory. Allows imports like `import X from "frontend/source/..."` in Svelte files.

### `server`
- `host`: "0.0.0.0" - Listen on all interfaces
- `port`: From `PORT` env var
- `strictPort`: true - Fail if port is in use
- `proxy`: `/backend` requests are rewritten (prefix stripped) and proxied to `localhost:{PORT+1}`. WebSocket proxying enabled.
- `fs.strict`: true - Only serve files within the frontend directory
- `watch.usePolling`: true - Required for hot module replacement (HMR) on WSL2
