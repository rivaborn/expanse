# compose.prod.yaml - Production Docker Compose

## Overview
Defines the production deployment with two services: a PostgreSQL database and the Expanse application container. Uses named volumes for persistent data and an internal network for service communication.

## Volumes
- `db` - Persistent PostgreSQL data directory
- `backups` - Persistent database backup storage (mounted into app container)

## Networks
- `net` - Internal bridge network with `attachable: false` (cannot be joined externally)

## Services

### `db` (PostgreSQL 14)
- Image: `docker.io/postgres:14`
- Port: `5432:5432`
- Logging: JSON file driver, max 50MB per file, 5 rotating files
- Volume: `db` → `/var/lib/postgresql/data/`
- Network: `net`
- Env file: `./backend/.env_prod` (provides `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`)
- Restart policy: `on-failure`

### `app` (Expanse application)
- Depends on: `db` (waits for db to be running before starting)
- Built from: project root (`.`)
- Image tag: `expanse-oauth-fix-v1:1.0`
- Logging: JSON file driver, max 50MB per file, 5 rotating files
- Working directory: `/app/`
- Volume: `backups` → `/app/backend/backups/`
- Network: `net`
- Port: `1301:1301`
- Environment: `VERSION=3.0.0` (used in Reddit API user-agent string)
- Env file: `./backend/.env_prod`
- Entrypoint: `[]` (overrides any Dockerfile default entrypoint)
- Command: `sh -c "wait-for-it db:5432 -t 0 && cd ./backend/ && npm run prod"` - waits indefinitely for PostgreSQL to be ready before starting the Node server
- Restart policy: `on-failure`
