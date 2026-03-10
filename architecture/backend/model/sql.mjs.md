# sql.mjs - PostgreSQL Database Layer

## Overview
Manages all PostgreSQL database operations including connection pooling, schema initialization, CRUD operations, and complex queries with full-text search support.

## Variables
- `pool` (pg.Pool) - PostgreSQL connection pool. Connection string is built from `PSQL_CONNECTION` env var if set, otherwise from individual `POSTGRES_USER`, `POSTGRES_PASSWORD`, `DB_HOST` (default `db`), `DB_PORT` (default `5432`), and `POSTGRES_DB` env vars. Max 1 connection in dev, 10 in prod. No idle timeout.

## Functions

### `init_db()`
Creates all database tables if they don't exist (within a transaction). In dev mode with `DEV_DROP_TABLES=true`, drops all existing tables first. Tables created: `user_`, `item`, `item_fn_to_import`, `user_item`, `item_sub_icon_url`.

### `query(query)`
Executes a single query against the pool. Accepts either a string or a prepared statement object `{text, values}`. Returns result rows.

### `transaction(queries)`
Executes multiple queries within a BEGIN/COMMIT transaction. Rolls back on error. Accepts array of query strings or prepared statement objects.

### `save_user(username, reddit_api_refresh_token_encrypted, category_sync_info, last_active_epoch)`
Inserts a new user. Uses `ON CONFLICT DO UPDATE` to handle previously purged users re-registering.

### `update_user(username, fields)`
Dynamically updates user fields. Accepts an object of field names to values. Handles string vs non-string values to produce proper SQL (quotes strings, no quotes for numbers).

### `get_user(username)`
Returns a single user row by username, or undefined if not found.

### `purge_user(username)`
Runs a 5-step transaction: nullifies user fields (`reddit_api_refresh_token_encrypted`, `category_sync_info`, `last_updated_epoch`, `last_active_epoch`), deletes user_item entries, cleans orphaned items, cleans orphaned import entries, cleans orphaned icon URLs.

### `get_all_non_purged_users()`
Returns usernames where `reddit_api_refresh_token_encrypted IS NOT NULL` (i.e., not purged).

### `insert_data(username, data)`
Batch inserts items, user_item relationships, and icon URLs using dynamically built prepared statements. Uses `ON CONFLICT DO NOTHING` for items and user_items. Uses `ON CONFLICT DO UPDATE SET url = excluded.url` for icon URLs (keeps them fresh). Skips entirely if `data.items` is empty.

### `get_data(username, filter, item_count, offset)`
Queries items with dynamic filtering by category, type, subreddit, and full-text search. Returns an object `{items, item_sub_icon_urls}`. Items are ordered by `created_epoch` descending. The `filter` object has: `category`, `type`, `sub`, `search_str`. Full-text search converts spaces to ` & ` for PostgreSQL `to_tsquery`. `item_count` can be an integer or `"all"`.

### `get_placeholder(username, filter)`
Returns count of items matching the filter (category and optional type). Used for search input placeholder text.

### `get_subs(username, filter)`
Returns distinct subreddits for items matching the filter (category and optional type), sorted alphabetically.

### `update_item(item_id, item_content)`
Updates an item's content (used by comment renewal). Uses a parameterized prepared statement.

### `delete_item_from_expanse_acc(username, item_id, item_category)`
Transaction with two steps: (1) deletes the `user_item` entry, (2) deletes the `item` itself only if no other `user_item` rows reference it.

### `parse_import(username, import_data)`
Batch inserts imported item fullnames into `item_fn_to_import` (id + fn_prefix) and user_item relationships (username + category + item_id). Batches in groups of 1000 to avoid exceeding PostgreSQL parameter limits.

### `get_fns_to_import(username, category)`
Returns up to 500 items from `item_fn_to_import` joined with `user_item` for the given username and category. Returns rows with `id` and `fn_prefix`.

### `delete_imported_fns(fns)`
Deletes processed import entries from `item_fn_to_import` by item ID. Accepts an array of fullname strings (e.g., `"t3_abc"`), extracts the ID portion after the `_`.

### `get_cached_sub_icons(subs)`
Returns a Set of subreddit names that already have entries in `item_sub_icon_url`. Used to skip fetching icons that are already cached. Accepts an array of subreddit name strings. Uses `ANY($1)` for efficient array lookup.
