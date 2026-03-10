# globals.js - Global Configuration

## Overview
Exports a single read-only configuration object used throughout the frontend. Initializes the Socket.IO client connection at module load time.

## Variables (within `readonly` object)
- `app_name` (string) - `"expanse"`
- `description` (string) - Full app description used in meta tags and the landing page
- `repo` (string) - GitHub repository URL (`"https://github.com/aplotor/expanse"`)
- `backend` (string) - Backend API base URL. In dev mode (`env_static_public.RUN == "dev"`): `"/backend"` (proxied by Vite to `localhost:{PORT+1}`). In prod: `""` (same origin, backend serves frontend).
- `socket` (Socket) - Socket.IO client instance. In dev mode: connects to `http://{window.location.hostname}:{PORT+1}` using the `app_env.browser` flag to determine hostname. In prod: connects to same origin (empty string).

## Imports
- `$app/env` - SvelteKit app environment (provides `browser` boolean)
- `$env/static/public` - SvelteKit public environment variables (provides `RUN`, `PORT`)
- `socket.io-client` - Socket.IO client library
