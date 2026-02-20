# logger.mjs - Logging Configuration

## Overview
Sets up Winston loggers for structured file-based logging.

## Variables
- `log` (function) - Bound info-level log function. Writes to `logs/log.txt`.
- `error` (function) - Bound error-level log function. Writes to `logs/error.txt`.

## Functions

### `create_logger(level)`
Creates a Winston logger instance with:
- **Format**: JSON with timestamps (YYYY-MM-DD HH:mm:ss) and pretty-printed output
- **Transport**: File only (console transport is commented out)
- **Filename**: `logs/log.txt` for info level, `logs/error.txt` for error level
