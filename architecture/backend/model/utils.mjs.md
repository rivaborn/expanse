# utils.mjs - Backend Utility Functions

## Overview
Shared utility functions used across the backend for time handling and string manipulation.

## Functions

### `now_epoch()`
Returns the current Unix timestamp in seconds (not milliseconds), as an integer via `Math.floor(Date.now() / 1000)`.

### `epoch_to_formatted_datetime(epoch)`
Converts a Unix epoch (seconds) to a formatted datetime string. Uses `en-GB` locale with UTC timezone, 12-hour format, and timezone name. Post-processes the result to:
- Replace `/` with `-` (date separators)
- Remove the comma between date and time
- Replace ` AM`/` PM` with `:AM`/`:PM`
- Zero-pad single-digit hours (checks if `split[1][1] == ":"`)

Used for database backup filenames and display in the frontend.

### `strip_trailing_slash(string)`
Removes a trailing `"/"` from a string if present, otherwise returns the string unchanged. Used to normalize Reddit permalink URLs before storing.
