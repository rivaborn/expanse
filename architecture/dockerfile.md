# dockerfile - Multi-Stage Docker Build

## Overview
Builds the Expanse application in three stages for an optimized production image.

## Stage 0: Backend Dependencies (Node.js 18)
- Working directory: `/app/backend/`
- Copies `package*.json` and `.npmrc`
- Runs `npm ci` for deterministic dependency installation
- Copies all backend source files

## Stage 1: Frontend Build (Node.js 18)
- Working directory: `/app/frontend/`
- Copies `package*.json` and `.npmrc`
- Runs `npm ci`
- Copies all frontend source files
- Runs `npm run build` to produce the static frontend build

## Stage 2: Runtime (Ubuntu 22.04)
- Installs: ca-certificates, curl, gnupg, postgresql-client-14, wait-for-it, Node.js 18, concurrently (npm global)
- Copies backend from Stage 0 to `/app/backend/`
- Copies frontend build output from Stage 1 to `/app/frontend/build/`

## Notes
- Uses `docker.io/node:18` and `docker.io/ubuntu:22.04` base images
- postgresql-client-14 is needed for `pg_dump` database backups
- wait-for-it is used in compose entrypoint to wait for PostgreSQL
- concurrently is installed globally but not actively used in current entrypoint
