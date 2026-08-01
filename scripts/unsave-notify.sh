#!/usr/bin/env bash
# Posts the per-user Expanse saved/unsave breakdown to ntfy topic "Expanse".
# Scheduled every 2h via crontab.
set -euo pipefail

NTFY_URL="http://192.168.1.30:2586/Expanse"
# Source label prefixed to every notification title. The "Expanse" ntfy topic is a
# shared bucket for multiple Expanse notifications; SOURCE says which one this is.
SOURCE="Expanse"
DB_CONTAINER="expanse-db-1"

SQL="select
       rpad(username, 20) || ' pend=' || lpad(count(*) filter (where reddit_unsaved_epoch is null)::text, 6)
       || ' unsaved=' || lpad(count(*) filter (where reddit_unsaved_epoch is not null)::text, 5)
       || ' total=' || lpad(count(*)::text, 6)
     from user_item
     where category = 'saved'
     group by username
     order by count(*) filter (where reddit_unsaved_epoch is null) desc;"

BODY=$(docker exec "$DB_CONTAINER" sh -c \
  "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -At -c \"$SQL\"" 2>&1) || {
    curl -s -m 10 -H "Title: [$SOURCE] unsave report FAILED" -H "Priority: high" -H "Tags: warning" \
      -d "psql query failed:
$BODY" "$NTFY_URL" >/dev/null || true
    echo "$(date '+%F %T') FAILED: psql query failed -- $BODY" >&2
    exit 1
  }

TOTAL_PEND=$(docker exec "$DB_CONTAINER" sh -c \
  "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -At -c \"select count(*) from user_item where category='saved' and reddit_unsaved_epoch is null;\"" 2>/dev/null || echo "?")

# Log the outcome so the cron redirect has something to capture — a silent
# success path left scripts/unsave-notify.log frozen and useless for debugging.
CODE=$(curl -s -m 10 -o /dev/null -w '%{http_code}' \
  -H "Title: [$SOURCE] saved/unsave — $TOTAL_PEND pending" \
  -H "Tags: floppy_disk" \
  -d "$BODY" \
  "$NTFY_URL" 2>/dev/null || echo 000)
echo "$(date '+%F %T') posted: saved/unsave — ${TOTAL_PEND} pending (ntfy http=${CODE})"
