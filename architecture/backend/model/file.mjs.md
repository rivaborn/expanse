# file.mjs - File Operations

## Overview
Handles file system operations including directory initialization, CSV import parsing, JSON export creation, and automated database backups using `pg_dump`.

## Imports
- `xlsx` - CSV/Excel file parsing library
- `fs` - Node.js file system module
- `child_process` - For spawning `pg_dump` process

## Functions

### `init()`
Ensures required directories exist: `logs/`, `tempfiles/`, `backups/` (all under `process.env.backend`). Behavior differs by environment:
- **Dev mode**: If directory already exists, clears its contents (truncates log files, deletes other files). If it doesn't exist, creates it.
- **Non-dev mode**: Creates directory unconditionally (assumes it doesn't exist yet).

### `parse_import(username, files)`
Parses uploaded CSV files from Reddit data request. Accepts an array of express-fileupload file objects. For each file:
- Reads CSV using xlsx library from buffer
- Maps file names to categories: `saved_posts.csv` → saved (t3_prefix), `saved_comments.csv` → saved (t1_prefix), `posts.csv` → created (t3_prefix), `comments.csv` → created (t1_prefix), `post_votes.csv` → upvoted/downvoted (t3_prefix, skips "none" direction), `hidden_posts.csv` → hidden (t3_prefix)
- Excludes anomaly fullnames where `item.id` contains a dot (known Reddit data request issue)
- Builds `import_data` with: `item_fns` (Set of `t3_id`/`t1_id` fullnames), `category_item_ids` (per-category Sets of raw item IDs)
- Passes result to `sql.parse_import()`

### `create_export(username)`
Creates a JSON export of all user data across all 5 categories (saved, created, upvoted, downvoted, hidden). For each category, calls `sql.get_data()` with `filter.type = "all"`, `filter.sub = "all"`, `filter.search_str = ""`, and `item_count = "all"`. Generates a 15-character random filename (from `Math.random().toString().slice(2, 17)`), writes to `tempfiles/{filename}.json`. Sets a 4-hour auto-delete timeout. Returns the filename string.

### `delete_oldest_if_reached_limit(limit, dir, what)`
Utility to maintain a maximum number of files in a directory. Reads all files, finds the oldest by `ctime` (creation time), and deletes it if the count exceeds `limit`. Logs the deleted filename and the limit.

- `limit` (number) - Maximum number of files allowed
- `dir` (string) - Directory path to check
- `what` (string) - Label for log messages (e.g., `"db backup"`)

### `backup_db()`
Runs `pg_dump` as a child process to create a SQL backup file in `backups/`. Uses `sql.pool.options.connectionString` as the database connection. Flags used: `-O` (no ownership), `-d` (connection string), `-f` (output file). Filename includes a formatted timestamp with colons replaced by the Unicode modifier colon character (꞉) and spaces replaced by underscores, to avoid filesystem issues. On successful exit (code 0), calls `delete_oldest_if_reached_limit(5, backups/, "db backup")`. Logs stderr and non-newline stdout.

### `cycle_backup_db()`
Starts the backup cycle. In dev mode, runs `backup_db()` immediately on startup. Then sets an interval to run `backup_db()` every 24 hours regardless of environment.
