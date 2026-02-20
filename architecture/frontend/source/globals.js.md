# globals.js - Global Configuration

## Overview
Exports a read-only configuration object used throughout the frontend. Initializes the Socket.IO client connection.

## Variables (within `readonly` object)
- `app_name` (string) - "expanse"
- `description` (string) - App description for meta tags and landing page
- `repo` (string) - GitHub repository URL
- `backend` (string) - Backend API base URL. In dev mode: `"/backend"` (proxied by Vite). In prod: `""` (same origin).
- `socket` (Socket) - Socket.IO client instance. In dev mode: connects to `http://{window.location.hostname}:{PORT+1}`. In prod: connects to same origin.
