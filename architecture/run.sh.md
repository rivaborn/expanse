# run.sh - CLI Helper Script

## Overview
Shell script for common development and production operations.

## Commands

### Development (`./run.sh dev ...`)

#### `./run.sh dev audit`
Runs `npm audit` in both backend and frontend directories.

#### `./run.sh dev outdated`
Runs `npm outdated` in both backend and frontend directories.

#### `./run.sh dev build`
1. Installs backend dependencies (`npm install`)
2. Installs frontend dependencies and builds (`npm install && npm run build`)
3. Builds Docker dev image (`docker compose -f ./compose.dev.yaml build`)

#### `./run.sh dev up`
Starts dev Docker Compose stack without building (`--no-build`).

### Production (`./run.sh prod ...`)

#### `./run.sh prod up`
Starts production stack in detached mode (`-d`). With `--watch` flag, runs in foreground.

#### `./run.sh prod down`
Stops and removes production containers.

#### `./run.sh prod update`
Full update sequence:
1. `prod down` - Stop running containers
2. `git pull` - Pull latest code
3. `docker compose pull` - Pull latest base images
4. `docker compose build` - Rebuild app image
5. `prod up` - Start updated stack
