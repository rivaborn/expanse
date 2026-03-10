# vite.config.js - Vite/SvelteKit Build Configuration

## Overview
Configures the Vite development server and SvelteKit plugin for the frontend.

## Configuration

### `plugins`
- `sveltekit()` - The official SvelteKit Vite plugin (imported from `@sveltejs/kit/vite`)

### `resolve.alias`
- `frontend` → the current working directory (the frontend project root). Allows imports like `import X from "frontend/source/..."` within Svelte files, avoiding relative path complexity.

### `server`
- `host`: `"0.0.0.0"` - Listens on all network interfaces (necessary for Docker/WSL2)
- `port`: Parsed from `PORT` env var
- `strictPort`: `true` - Fails immediately if the port is already in use
- `proxy`: `/backend` path prefix is stripped (regex rewrite) and requests are forwarded to `http://localhost:{PORT+1}`. WebSocket proxying enabled (`ws: true`). Used in dev mode to proxy frontend requests to the backend Express server.
- `fs.strict`: `true` - Only serves files within the frontend directory (security)
- `fs.allow`: `[frontend]` - Explicitly allows serving from the frontend root
- `watch.usePolling`: `true` - Required for hot module replacement (HMR) in WSL2 environments where inotify events don't propagate correctly
