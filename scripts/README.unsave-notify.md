# Expanse unsave notifier

`unsave-notify.sh` posts the per-user Expanse **saved** category breakdown
(pending / unsaved / total, sorted by pending desc) to ntfy every 2 hours.

## ntfy endpoint
- URL:   `http://192.168.1.30:2586/Expanse`
- Topic: `Expanse` (self-hosted ntfy at 192.168.1.30:2586 — same server scrutiny uses)
- The topic name is a weak shared secret: anyone who knows it can subscribe/publish.
  Rotate by editing NTFY_URL in the script AND every subscriber.

## Source prefix convention
The `Expanse` topic is a shared bucket for multiple Expanse-related notifications.
So each notifier states its source: every message title is prefixed with `[$SOURCE]`,
where `SOURCE` is a variable near the top of the script (here: `SOURCE="Expanse"`).

When adding another notifier that publishes to this topic, set its own `SOURCE`
(e.g. `SOURCE="sync-errors"`) so recipients can tell messages apart at a glance:

    [Expanse] saved/unsave — 15799 pending      <- this script
    [sync-errors] 3 users failed to sync         <- a hypothetical future notifier

The topic stays `Expanse`; only the SOURCE prefix distinguishes notifiers.

## What "pending" means
Rows in `user_item` where `category='saved'` and `reddit_unsaved_epoch IS NULL`
(not yet unsaved from Reddit). Because Reddit's ~1000 saved limit is a rolling
retention cap, most pending rows are items Reddit already evicted, so the drain
fires idempotent no-op unsaves against them — pending count != items still live-saved.

## Schedule
Installed in `fksogbetun`'s crontab, tagged with a self-managed marker:

    # MANAGED-BY: expanse-unsave-notify ...
    0 */2 * * * /home/fksogbetun/expanse/scripts/unsave-notify.sh >> .../unsave-notify.log 2>&1

Re-running the installer greps out any line matching `unsave-notify.sh` or the
`MANAGED-BY: expanse-unsave-notify` marker before re-adding, so it's idempotent
and touches no other cron entries.

## Files
- `unsave-notify.sh`        — the script (queries `expanse-db-1`, posts to ntfy)
- `unsave-notify.log`       — cron stdout/stderr
- `README.unsave-notify.md` — this file

## Remove
    crontab -l | grep -vE 'unsave-notify\.sh|MANAGED-BY: expanse-unsave-notify' | crontab -
