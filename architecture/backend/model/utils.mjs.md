# utils.mjs - Backend Utility Functions

## Overview
Shared utility functions used across the backend.

## Functions

### `now_epoch()`
Returns the current Unix timestamp in seconds (not milliseconds).

### `epoch_to_formatted_datetime(epoch)`
Converts a Unix epoch (seconds) to a formatted datetime string in "DD-MM-YYYY HH:MM:SS:AM/PM UTC" format using en-GB locale. Zero-pads single-digit hours.

### `strip_trailing_slash(string)`
Removes a trailing "/" from a string if present. Used to normalize Reddit permalink URLs.
