# logger.mjs - Logging Configuration

## Overview
Sets up Winston loggers for structured file-based logging. Exports bound logging functions used throughout the backend for persistent log records (separate from `console.log` which is used for ephemeral tracing).

## Variables
- `log` (function) - Bound `info`-level log function. Writes to `logs/log.txt`.
- `error` (function) - Bound `error`-level log function. Writes to `logs/error.txt`.

## Functions

### `create_logger(level)`
Creates a Winston logger instance with:
- **Format**: `combine(timestamp, json, printf)` - outputs pretty-printed JSON with `timestamp` and `message` fields only. Timestamp format: `"YYYY-MM-DD HH:mm:ss"`.
- **Transport**: File only. Console transport exists in code but is commented out.
- **Filename**: `logs/log.txt` for `"info"` level, `logs/error.txt` for `"error"` level.

Returns the configured logger.
