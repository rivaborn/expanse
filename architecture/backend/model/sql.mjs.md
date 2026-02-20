# sql.mjs - PostgreSQL Database Layer

## Overview
Manages all PostgreSQL database operations including connection pooling, schema initialization, CRUD operations, and complex queries with full-text search support.

## Variables
- `pool` (pg.Pool) - PostgreSQL connection pool. Max 1 connection in dev, 10 in prod. No idle timeout.

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
Dynamically updates user fields. Accepts an object of field names to values.

### `get_user(username)`
Returns a single user row by username, or undefined if not found.

### `purge_user(username)`
Runs a 5-step transaction: nullifies user fields, deletes user_items, cleans orphaned items, cleans orphaned import entries, cleans orphaned icon URLs.

### `get_all_non_purged_users()`
Returns usernames where `reddit_api_refresh_token_encrypted IS NOT NULL` (i.e., not purged).

### `insert_data(username, data)`
Batch inserts items, user_item relationships, and icon URLs using dynamically built prepared statements. Uses `ON CONFLICT DO NOTHING` for items/user_items, `ON CONFLICT DO UPDATE` for icon URLs.

### `get_data(username, filter, item_count, offset)`
Queries items with dynamic filtering by category, type, subreddit, and full-text search. Returns items (ordered by created_epoch desc) and their subreddit icon URLs. The `filter` object has: `category`, `type`, `sub`, `search_str`.

### `get_placeholder(username, filter)`
Returns count of items matching the filter (for search input placeholder text).

### `get_subs(username, filter)`
Returns distinct subreddits for items matching the filter, sorted alphabetically.

### `update_item(item_id, item_content)`
Updates an item's content (used by comment renewal).

### `delete_item_from_expanse_acc(username, item_id, item_category)`
Deletes user_item entry, then deletes the item itself if no other user references it.

### `parse_import(username, import_data)`
Batch inserts imported item fullnames into `item_fn_to_import` and user_item relationships. Batches in groups of 1000 to avoid exceeding PostgreSQL parameter limits.

### `get_fns_to_import(username, category)`
Returns up to 500 items from `item_fn_to_import` that belong to the user in the given category.

### `delete_imported_fns(fns)`
Deletes processed import entries from `item_fn_to_import`.
