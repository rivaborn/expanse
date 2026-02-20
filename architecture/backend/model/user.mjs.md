# user.mjs - User Model and Sync Logic

## Overview
Contains the User class with methods for syncing Reddit data, managing categories, and performing user operations. Also contains module-level functions for user lifecycle management and the background sync cycle.

## Module Variables
- `update_all_completed` (boolean|null) - Flag to prevent overlapping sync cycles
- `usernames_to_socket_ids` (object) - Maps usernames to their active socket IDs. Keys persist for all non-purged users; values are socket IDs when connected, null when disconnected.
- `socket_ids_to_usernames` (object) - Reverse mapping of socket IDs to usernames

## User Class

### Constructor `User(username, refresh_token, dummy=false)`
- Normal mode: encrypts refresh token, initializes `category_sync_info` with null pointers for all 5 categories, sets `last_active_epoch` to now
- Dummy mode (`dummy=true`): only sets username (used when reconstructing from DB via `Object.assign`)

### `category_sync_info` structure
Tracks sync cursors per category:
- `saved`: `{latest_fn_mixed, latest_new_data_epoch}` - fullname of newest saved item (posts+comments mixed)
- `created`: `{latest_fn_posts, latest_fn_comments, latest_new_data_epoch}` - separate cursors for posts and comments
- `upvoted`/`downvoted`/`hidden`: `{latest_fn_posts, latest_new_data_epoch}` - posts only

### `save()`
Saves user to database. If user exists and has been updated before (returning user), only updates the refresh token. If new or previously purged, does full insert.

### `get_listing(options, category, type)`
Calls the appropriate snoowrap method to fetch a Reddit listing. Maps categories to snoowrap methods (getSavedContent, getSubmissions, getComments, getUpvotedContent, getDownvotedContent, getHiddenContent).

### `parse_listing(listing, category, type, from_mixed=false, from_import=false)`
Processes a Reddit listing into `this.new_data`. For mixed listings (saved), splits into posts and comments then recursively parses each. Extracts: id, type, content, author, sub, url, created_epoch. Updates `latest_fn_*` sync cursors. Collects subreddit names for icon URL fetching.

### `replace_latest_fn(category, type)`
Re-fetches the single latest item for a category to update the sync cursor. Used when the previous latest item was deleted.

### `fetch_upvoted_page({before, after}, limit)`
Manual Reddit API request for upvoted items, bypassing snoowrap's default behavior that adds large `count` values causing upstream 500 errors. Returns array of SubmissionStub/CommentStub objects.

### `sync_category(category, type)`
Main sync logic for a category. Two paths:
- **Upvoted**: Uses custom `fetch_upvoted_page()` with manual pagination (PAGE_LIMIT=20, max UPVOTED_MAX_FETCH items). Walks forward from cursor, stops when reaching stored cursor or limit.
- **Other categories**: Uses snoowrap's `get_listing()` with `before` parameter pointing to latest stored fullname. Fetches in pages of 20, max 100 items total.

### `import_category(category, type)`
Fetches actual item data from Reddit for items that were imported via CSV. Gets fullnames from `item_fn_to_import` table, fetches in batches of 100 via `getContentByIds()`, parses results.

### `request_item_icon_urls(type, subs)`
Fetches subreddit/user icon URLs from Reddit API. For subreddits (`r/`): uses `api/info` endpoint, batches of 100. For users (`u/`): uses `{username}/about` endpoint, one per request. Respects rate limits.

### `get_new_item_icon_urls()`
Splits `sub_icon_urls_to_get` into r/ subs and u/ subs, then fetches icons for each type.

### `update(io=null, socket_id=null)`
Main sync orchestrator. Creates snoowrap requester, syncs all 5 categories in parallel (each category syncs + imports), fetches icon URLs, inserts all data to DB, updates sync timestamps. When `io` and `socket_id` are provided (initial load), emits progress events (7 total steps).

### `renew_comment(comment_id)`
Re-fetches a comment's body from Reddit and updates it in the database.

### `delete_item_from_reddit_acc(item_id, item_category, item_type)`
Performs the Reddit API action to remove an item (unsave/delete/unvote/unhide). If the deleted item was the sync cursor, refreshes the cursor.

### `purge()`
Calls `sql.purge_user()` and removes username from socket mappings.

## Module Functions

### `fill_usernames_to_socket_ids()`
Loads all non-purged usernames from DB and initializes them in `usernames_to_socket_ids` with null socket IDs.

### `get(username, existence_check=false)`
Retrieves a user from DB and reconstructs it as a User instance via `Object.assign`. Parses epoch fields from strings to integers. Throws if user doesn't exist.

### `update_all(io)`
Background sync function. Iterates all usernames in `usernames_to_socket_ids`, skips users updated less than 30 seconds ago. For each user: syncs data, detects new data by comparing `latest_new_data_epoch` before/after, broadcasts to `view:<username>` Socket.IO room. On 403 errors with `before` parameter, attempts to refresh the sync cursor.

### `cycle_update_all(io)`
Starts the background sync cycle. Runs `update_all()` immediately, then on interval of `UPDATE_CYCLE_INTERVAL` minutes (default 1). Only starts new cycle if previous completed.
