# run.sh - CLI Helper Script

## Overview
Shell script for common development and production operations. Takes two positional arguments: environment (`dev`/`prod`) and command.

## Commands

### Development (`./run.sh dev ...`)

#### `./run.sh dev audit`
Runs `npm audit` in both backend and frontend directories (sequentially).

#### `./run.sh dev outdated`
Runs `npm outdated` in both backend and frontend directories (sequentially).

#### `./run.sh dev build`
1. Installs backend dependencies (`npm install`)
2. Installs frontend dependencies and builds (`npm install && npm run build`)
3. Builds Docker dev image (`docker compose -f ./compose.dev.yaml build`)

#### `./run.sh dev up`
Starts the dev Docker Compose stack without rebuilding images (`--no-build`).

### Production (`./run.sh prod ...`)

#### `./run.sh prod up`
Starts the production stack with a fresh build in detached mode (`-d --build`). With the optional `--watch` flag as a third argument, runs in the foreground (without `-d`).

#### `./run.sh prod down`
Stops and removes production containers via `docker compose -f ./compose.prod.yaml down`.

#### `./run.sh prod update`
Full rolling update sequence:
1. `prod down` - Stop and remove running containers
2. `git pull` - Pull latest code from remote
3. `docker compose pull` - Pull latest base images (e.g., postgres:14)
4. `docker compose build` - Rebuild the app image with new code
5. `prod up` - Start the updated stack
