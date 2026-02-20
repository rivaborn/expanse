# compose.prod.yaml - Production Docker Compose

## Overview
Defines the production deployment with two services: PostgreSQL database and the Expanse application.

## Volumes
- `db` - Persistent PostgreSQL data storage
- `backups` - Persistent database backup storage

## Networks
- `net` - Internal network (not attachable from outside)

## Services

### `db` (PostgreSQL 14)
- Image: `docker.io/postgres:14`
- Port: 5432:5432
- Logging: JSON file driver, max 50MB per file, 5 files
- Volume: `db` → `/var/lib/postgresql/data/`
- Network: `net`
- Env file: `./backend/.env_prod`
- Restart: on-failure

### `app` (Expanse)
- Depends on: `db`
- Image: `expanse-oauth-fix-v1:1.0` (custom built image)
- Logging: JSON file driver, max 50MB per file, 5 files
- Working dir: `/app/`
- Volume: `backups` → `/app/backend/backups/`
- Network: `net`
- Port: 1301:1301
- Environment: `VERSION=3.0.0`
- Env file: `./backend/.env_prod`
- Entrypoint: empty (overrides Dockerfile default)
- Command: `wait-for-it db:5432 -t 0 && cd ./backend/ && npm run prod`
- Restart: on-failure
