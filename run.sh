#!/usr/bin/env bash
set -e

DEV_COMPOSE=./compose.dev.yaml
PROD_COMPOSE=./compose.prod.yaml

usage() {
	cat <<EOF
Usage:
    ./run.sh dev audit          npm audit in backend and frontend
    ./run.sh dev outdated       npm outdated in backend and frontend
    ./run.sh dev build          install deps, build frontend, build dev image
    ./run.sh dev up             start dev stack (no rebuild)

    ./run.sh prod up [--watch]  start prod stack (detached unless --watch)
    ./run.sh prod down          stop prod stack
    ./run.sh prod build         build prod image
    ./run.sh prod update        pull, rebuild, restart
EOF
	exit 1
}

case "${1:-}" in
	dev)
		case "${2:-}" in
			audit)
				(cd ./backend/ && npm audit)
				(cd ./frontend/ && npm audit)
				;;
			outdated)
				(cd ./backend/ && npm outdated)
				(cd ./frontend/ && npm outdated)
				;;
			build)
				(cd ./backend/ && npm install)
				(cd ./frontend/ && npm install && npm run build)
				docker compose -f "$DEV_COMPOSE" build
				;;
			up)
				docker compose -f "$DEV_COMPOSE" up --no-build
				;;
			*) usage ;;
		esac
		;;
	prod)
		case "${2:-}" in
			up)
				if [ "${3:-}" = "--watch" ]; then
					docker compose -f "$PROD_COMPOSE" up --build
				else
					docker compose -f "$PROD_COMPOSE" up -d --build
				fi
				;;
			down)
				docker compose -f "$PROD_COMPOSE" down
				;;
			build)
				docker compose -f "$PROD_COMPOSE" build
				;;
			update)
				./run.sh prod down
				git pull
				docker compose -f "$PROD_COMPOSE" pull
				docker compose -f "$PROD_COMPOSE" build
				./run.sh prod up
				;;
			*) usage ;;
		esac
		;;
	*) usage ;;
esac
