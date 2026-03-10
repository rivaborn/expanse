# user.mjs - User Model and Sync Logic

## Overview
Contains the User class with methods for syncing Reddit data, managing categories, and performing user operations. Also contains module-level functions for user lifecycle management and the background sync cycle.

## Module Variables
- `update_all_completed` (boolean|null) - Flag to prevent overlapping sync cycles. Starts as `null`.
- `ratelimit_wait_until` (number) - Timestamp (ms) until which to wait before retrying after a rate limit hit. Starts at 0.
- `usernames_to_socket_ids` (object) - Maps usernames to their active socket IDs. Keys persist for all non-purged users; values are socket IDs when connected, null when disconnected.
- `socket_ids_to_usernames` (object) - Reverse mapping of socket IDs to usernames.

## User Class

### Constructor `User(username, refresh_token, dummy=false)`
- Normal mode: encrypts refresh token using `cryptr.encrypt()`, initializes `category_sync_info` with null pointers for all 5 categories, sets `last_active_epoch` to now.
- Dummy mode (`dummy=true`): only sets username (used when reconstructing from DB via `Object.assign`).

### `category_sync_info` structure
Tracks sync cursors per category:
- `saved`: `{latest_fn_mixed, latest_new_data_epoch}` - fullname of newest saved item (posts+comments mixed)
- `created`: `{latest_fn_posts, latest_fn_comments, latest_new_data_epoch}` - separate cursors for posts and comments
- `upvoted`/`downvoted`/`hidden`: `{latest_fn_posts, latest_new_data_epoch}` - posts only

### `save()`
Saves user to database. If the user already exists in the DB and has been synced at least once (`last_updated_epoch` is set), only updates the refresh token (returning user login). If new or previously purged, does a full insert via `sql.save_user()`.

### `get_listing(options, category, type)`
Calls the appropriate snoowrap method to fetch a Reddit listing. Maps categories to snoowrap methods: `getSavedContent`, `getSubmissions`, `getComments`, `getUpvotedContent`, `getDownvotedContent`, `getHiddenContent`.

### `parse_listing(listing, category, type, from_mixed=false, from_import=false)`
Processes a Reddit listing into `this.new_data`. For mixed listings (saved category, `type == "mixed"`), splits into posts and comments and recursively calls itself for each. For non-mixed listings: updates `latest_fn_*` sync cursor (unless `from_mixed` or `from_import`). Extracts per-item: id, type ("post"/"comment"), content (title or body), author (`u/{name}`), sub (subreddit_name_prefixed), url (full Reddit permalink with trailing slash stripped), created_epoch. Adds subreddit name to `this.sub_icon_urls_to_get`.

### `replace_latest_fn(category, type)`
Re-fetches the single latest item (limit 1) for a category/type using `get_listing()` and updates the sync cursor. Used when no new items were found (cursor may point to a deleted item).

### `fetch_upvoted_page({before, after}, limit)`
Manual Reddit API request for upvoted items via `this.requester.oauthRequest()`, bypassing snoowrap's default behavior that adds large `count` values causing upstream 500 errors. Parses the raw response and returns an array of `SubmissionStub` or `CommentStub` objects constructed from the raw API children. Logs empty pages for debugging.

### `sync_category(category, type)`
Main sync logic for a category. Two distinct paths:
- **Upvoted**: Uses custom `fetch_upvoted_page()` with manual forward pagination. `PAGE_LIMIT=20`, max `UPVOTED_MAX_FETCH` items (env var, default 500). Walks pages using `after` cursor, stops when reaching `latest_fn_posts` (stored cursor) or hitting the max. Logs a warning if max is reached without finding the cursor. Calls `parse_listing()` with sorted results (newest first), or `replace_latest_fn()` if no new items.
- **Other categories**: Uses snoowrap `get_listing()` with `before` parameter pointing to stored cursor fullname. Fetches in pages of 20 up to max 100 items total using `listing.fetchMore()`. Calls `parse_listing()` for initial and additional pages. If nothing found, calls `replace_latest_fn()`.

### `import_category(category, type)`
Fetches actual item data from Reddit for items that were imported via CSV. Gets up to 500 fullnames from `item_fn_to_import` table via `sql.get_fns_to_import()`, then fetches in batches of 100 via `requester.getContentByIds()`. Parses all results with `parse_listing()` using `from_import=true`. Adds processed fullnames to `this.imported_fns_to_delete`.

### `request_item_icon_urls(type, subs)`
Fetches subreddit/user icon URLs from Reddit API. Respects rate limit by checking `this.requester.ratelimitRemaining`.
- For subreddits (`r/`): uses `api/info` endpoint with `sr_name` param, batches of 100. Extracts `icon_img` or `community_icon`, strips query params.
- For users (`u/`): uses `{sub}/about` endpoint one per request. Tries multiple icon fields in priority order: `icon_img`, `subreddit.display_name.icon_img`, `community_icon`, `subreddit.display_name.community_icon`, `snoovatar_img`, `subreddit.display_name.snoovatar_img`.
- Stores results in `this.new_data.item_sub_icon_urls`. Falls back to `"#"` if no icon found.

### `get_new_item_icon_urls()`
Splits `this.sub_icon_urls_to_get` into r/ and u/ arrays, filters out already-cached subs via `sql.get_cached_sub_icons()`, then calls `request_item_icon_urls()` for each non-empty group. Logs the count of fetched vs cached.

### `update(io=null, socket_id=null, is_retry=false)`
Main sync orchestrator. Creates snoowrap requester and fetches `this.me`. Logs ratelimit status at start.
- If `is_retry=false`: initializes `this.new_data`, `this.sub_icon_urls_to_get`, `this.imported_fns_to_delete`, and all category sets.
- If `is_retry=true`: logs how many items were carried over from the previous partial attempt.
- Runs 5 category sync+import operations (saved, created, upvoted, downvoted, hidden) as separate Promises resolved in parallel via `Promise.all()`. Each captures category-specific errors with `err.extras`.
- After all categories: calls `get_new_item_icon_urls()`, inserts data to DB, deletes processed import fns.
- Updates `last_updated_epoch` in DB. Emits 7 `"update progress"` events when `io` is provided.
- Logs total time and final item counts. Cleans up `new_data`, `sub_icon_urls_to_get`, `imported_fns_to_delete` from instance.

### `_format_item_counts()`
Returns a formatted summary string of item counts per category from `this.new_data.category_item_ids`. Example: `"Saved (3), Created (0), Upvoted (12), Downvoted (0), Hidden (1)"`.

### `renew_comment(comment_id)`
Creates a fresh snoowrap requester, fetches the comment by ID, updates the content in the database via `sql.update_item()`, and returns the new comment body.

### `delete_item_from_reddit_acc(item_id, item_category, item_type)`
Creates a fresh snoowrap requester. Gets the item object (Submission or Comment). Checks if the item is the current sync cursor; if so, sets `replace_latest_fn = true`. Performs the Reddit API action: unsave (saved), delete (created), unvote (upvoted/downvoted), unhide (hidden). If cursor replacement is needed: re-fetches `this.me`, calls `replace_latest_fn()`, and persists updated `category_sync_info` to DB.

### `purge()`
Calls `sql.purge_user()` and removes username from `usernames_to_socket_ids`.

## Module Functions

### `fill_usernames_to_socket_ids()`
Loads all non-purged usernames from DB and initializes them in `usernames_to_socket_ids` with null socket IDs.

### `get(username, existence_check=false)`
Retrieves a user from DB and reconstructs it as a User instance via `Object.assign(new User(null, null, true), plainObject)`. Parses `last_updated_epoch` and `last_active_epoch` from strings to integers. Throws an Error with message `"user (username) dne"` if not found.

### `update_all(io)`
Background sync function. Iterates all usernames in `usernames_to_socket_ids`. Skips users updated less than 30 seconds ago. For each user, runs a retry loop (`do...while (should_retry)`):
- Calls `user.update()` with `is_retry = retry_count > 0`
- On success: compares pre/post `latest_new_data_epoch` per category, broadcasts `"show refresh alert"` and `"store last updated epoch"` to `view:<username>` Socket.IO room
- On 429 rate limit error: sets `ratelimit_wait_until` from response header and retries
- On `RateLimitError`: sets `ratelimit_wait_until` from `requester.ratelimitExpiration` and retries
- On 403/404 with `before` cursor param: resets the stale cursor for the affected category in DB, saves any partial data already collected via `sql.insert_data()` and updates `last_updated_epoch`, then logs the partial save
- After each user: if rate limit is low (< 50 remaining), waits for reset before continuing
- Logs retry counts and cycle duration. Sets `update_all_completed = true` in a `finally` block.

### `cycle_update_all(io)`
Starts the background sync cycle. Runs `update_all()` immediately, then on an interval of `max(1, UPDATE_CYCLE_INTERVAL)` minutes. Only starts a new cycle if the previous one completed (`update_all_completed === true`).
