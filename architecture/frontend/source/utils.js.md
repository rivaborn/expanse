# utils.js - Frontend Utility Functions

## Overview
Client-side utility functions for time formatting and UI effects. Mirrors several functions from the backend `utils.mjs`.

## Functions

### `now_epoch()` (internal, not exported)
Returns the current Unix timestamp in seconds via `Math.floor(Date.now() / 1000)`. Used internally by `time_since()`.

### `epoch_to_formatted_datetime(epoch)`
Converts a Unix epoch (seconds) to a formatted datetime string. Uses `en-GB` locale with UTC timezone, 12-hour format, and timezone name. Post-processes the result: replaces `/` with `-`, removes comma, replaces ` AM`/` PM` with `:AM`/`:PM`, zero-pads single-digit hours. Same logic as backend `utils.mjs`.

### `time_since(epoch)`
Returns a human-readable relative time string comparing the given epoch to now. Returns the largest applicable unit:
- `>= 1 year`: `"N Years"`
- `>= 1 month (2592000s)`: `"N Months"`
- `>= 1 day (86400s)`: `"N Days"`
- `>= 1 hour (3600s)`: `"N Hours"`
- `>= 1 minute (60s)`: `"N Minutes"`
- Otherwise: `"N Seconds"`

### `shake_element(element)`
Adds the CSS class `"shake"` to a DOM element, then removes it after 300ms. Provides visual validation feedback (e.g., when the purge confirmation text is incorrect or no delete-from option is selected).

### `show_alert(alert_wrapper, message, type)`
Replaces the inner HTML of `alert_wrapper` with a Bootstrap `alert alert-{type}` div containing `message`. Used for the new-data refresh alert in access.svelte.
