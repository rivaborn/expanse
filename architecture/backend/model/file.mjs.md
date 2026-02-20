# file.mjs - File Operations

## Overview
Handles file system operations including directory initialization, CSV import parsing, JSON export creation, and automated database backups.

## Imports
- `xlsx` - CSV/Excel file parsing library
- `fs` - Node.js file system module
- `child_process` - For spawning pg_dump process

## Functions

### `init()`
Ensures required directories exist: `logs/`, `tempfiles/`, `backups/`. In dev mode, clears existing files (truncates logs, deletes tempfiles and backups).

### `parse_import(username, files)`
Parses uploaded CSV files from Reddit data request. Accepts an array of file objects. For each file:
- Reads CSV using xlsx library
- Maps file names to categories: saved_posts.csv → saved, comments.csv → created, post_votes.csv → upvoted/downvoted, etc.
- Builds `import_data` with item fullnames (`t1_`/`t3_` prefixed) and category-to-item-id mappings
- Excludes anomaly fullnames (containing dots)
- Passes result to `sql.parse_import()`

### `create_export(username)`
Creates a JSON export of all user data across all 5 categories. Generates a random filename, writes to `tempfiles/`, sets a 4-hour auto-delete timeout. Returns the filename.

### `delete_oldest_if_reached_limit(limit, dir, what)`
Utility to maintain a maximum number of files in a directory. Finds and deletes the oldest file (by creation time) if count exceeds limit.

### `backup_db()`
Runs `pg_dump` as a child process to create a SQL backup file. Filename includes formatted timestamp. After successful backup, calls `delete_oldest_if_reached_limit(5)` to keep max 5 backups.

### `cycle_backup_db()`
Starts the backup cycle. In dev mode, runs immediately. Then runs every 24 hours.
