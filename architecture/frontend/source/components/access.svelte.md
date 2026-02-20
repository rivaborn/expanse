# access.svelte - Main Data Browsing View

## Overview
The primary data viewing component. Displays Reddit items with filtering, searching, pagination, and user switching. Write operations (delete, renew) are conditionally shown based on authentication.

## Module Scope
Imports globals, utils, Navbar, svelte, jQuery (for Bootstrap Select plugin).

## Instance Scope

### Props
- `auth_username` (string|null) - Authenticated Reddit username
- `view_username` (string) - Username whose data is being displayed
- `available_users` (array) - All available usernames for the switcher dropdown
- `online_users` (array) - Currently syncing usernames

### Key Variables
- `is_own_data` (reactive) - `auth_username && auth_username === view_username`. Controls visibility of write buttons.
- `view_user_is_syncing` (boolean) - Whether the viewed user is currently authenticated/syncing. Controls countdown visibility.
- `selected_user` (string) - Current selection in user switcher dropdown
- `active_category` (string) - Current filter category (saved/created/upvoted/downvoted/hidden)
- `active_type` (string) - Current filter type (posts/comments/all)
- `active_sub` (string) - Current subreddit filter
- `active_search_str` (string) - Current search query
- `last_updated_epoch` (number|null) - Timestamp of last sync for viewed user
- `last_updated_wrappers_update_interval_id` - Interval ID for countdown timer
- DOM references: `item_list`, `skeleton_list`, `search_input`, `search_btn`, `subreddit_select`, `category_btn_group`, `type_btn_group`, `new_data_alert_wrapper`, `last_updated_wrapper_1`, `last_updated_wrapper_2`

### Functions

#### `refresh_item_list()`
Fetches items from server with current filters. Builds HTML for each item including: subreddit icon, title/content, author, subreddit, time since creation, permalink. When `is_own_data` is true, adds delete buttons (from Expanse and from Reddit). Implements infinite scroll by detecting scroll position and loading more items.

#### `update_search_placeholder()`
Emits `"get placeholder"` to get item count, updates search input placeholder text.

#### `fill_subreddit_select()`
Emits `"get subs"` to populate the subreddit filter dropdown with Bootstrap Select.

#### `switch_view_user()`
Handles user switching within the Access page. Emits `"set view user"`, waits for `"view user set"` response, updates `view_username`, `view_user_is_syncing`, `last_updated_epoch`, then refreshes all data.

#### `hide_skeleton_loading()`
Hides skeleton loading placeholders and shows the actual item list.

#### `handle_body_click(evt)` / `handle_body_keydown(evt)`
Global event handlers for closing popovers on outside click/Escape key.

### `onMount`
1. Emits `"page" "access"` socket event
2. If `view_username` is set: emits `"set view user"` and **awaits** the response before proceeding (prevents race condition where data requests arrive before view user is set)
3. Sets up socket listeners for `"store last updated epoch"` and `"show refresh alert"`
4. Starts 1-second interval for countdown timer (with null guards for DOM refs)
5. Fetches initial data, hides skeleton, populates search placeholder and subreddit dropdown
6. Initializes Bootstrap Select plugin
7. Sets up event listeners for subreddit select change, search input (Enter/Escape/Backspace), search button click, infinite scroll

### `onDestroy`
Removes `"store last updated epoch"` and `"show refresh alert"` socket listeners. Clears countdown interval.

## Template
- Navbar with `auth_username` and `show_data_anchors={is_own_data}`
- App name heading
- **User switcher** (shown when multiple users or not authenticated): dropdown with "(syncing)" indicators, "switch" button
- "viewing: u/{view_username}" with "(read-only)" indicator when not own data
- **Countdown** (shown only when `view_user_is_syncing`): "last synced: X ago", clickable to show full datetime
- New data alert area
- **Filter controls**: category buttons (saved/created/upvoted/downvoted/hidden), type buttons (posts/comments/all), search input with button, subreddit dropdown (Bootstrap Select)
- **Item list**: scrollable list with skeleton loading placeholders
