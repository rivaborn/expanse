# access.svelte - Main Data Browsing View

## Overview
The primary data viewing component. Displays Reddit items with filtering, searching, infinite-scroll pagination, and user switching. Write operations (delete, renew) are conditionally shown based on whether the authenticated user is viewing their own data.

## Module Scope
Imports: `globals`, `utils`, `Navbar`, `svelte`, `axios`, `underscore`. Reads `globals.readonly` into `globals_r`.

## Instance Scope

### Props
- `auth_username` (string|null) - Authenticated Reddit username
- `view_username` (string) - Username whose data is being displayed
- `available_users` (array) - All available usernames for the user switcher dropdown
- `online_users` (array) - Currently syncing usernames (have active socket connections)

### Key Variables
- `is_own_data` (reactive `$:`) - `auth_username && auth_username === view_username`. Controls visibility of write buttons (delete, renew, export in navbar).
- `view_user_is_syncing` (boolean) - Whether the viewed user is currently online. Initialized from `online_users.includes(view_username)`.
- `selected_user` (string) - Current selection in user switcher dropdown, initialized to `view_username`.
- `active_category` (string) - Current filter category. Default: `"saved"`.
- `active_type` (string) - Current filter type. Default: `"all"`.
- `active_sub` (string) - Current subreddit filter. Default: `"all"`.
- `active_search_str` (string) - Current search query string. Default: `""`.
- `last_updated_epoch` (number|null) - Timestamp of last sync for the viewed user.
- `last_updated_wrappers_update_interval_id` - Interval ID for the last-synced time display updater.
- `items_currently_listed` (number) - Count of items rendered so far (used for pagination offset).
- DOM references (all initialized as part of a destructured array): `last_updated_wrapper_1`, `last_updated_wrapper_2`, `search_input`, `search_btn`, `subreddit_select`, `subreddit_select_btn`, `subreddit_select_dropdown`, `category_btn_group`, `type_btn_group`, `item_list`, `skeleton_list`, `new_data_alert_wrapper`.
- `intersection_observer` (IntersectionObserver) - Watches the item at `offset + count - Math.floor(count/2) - 1` to trigger loading of the next page when it enters the viewport.
- `debounced_hide_popover` - Debounced function (100ms, leading edge) to hide Bootstrap popovers on scroll.

### Functions

#### `handle_body_click(evt)`
Global click handler attached to `<svelte:body>`. Handles:
- Clicking dropdown items blurs the subreddit select button
- Clicking anywhere with `data-url` opens that URL in a new tab (unless clicked element is a BUTTON)
- `.copy_link_btn` - copies item URL to clipboard, flashes green
- `.text_btn` - toggles post text via Pushshift API (`https://api.pushshift.io/reddit/search/submission?ids=...`); shows error if Pushshift is down
- `.renew_btn` - emits `"renew comment"` socket event, updates content on response
- `.delete_btn` - manages popover state (closes others, keeps current)
- `.row_1_popover_btn` - toggles active state for delete-from option (expanse/Reddit/both)
- `.delete_item_confirm_btn` - validates a delete-from option is selected, then emits `"delete item from expanse acc"` and/or `"delete item from reddit acc"` as appropriate; removes item from DOM on expanse deletion
- Category button group click - reads active button text, updates `active_category`, refreshes list/placeholder/subs
- Type button group click - reads active button text, updates `active_type`, refreshes list/placeholder/subs
- `#refresh_btn` click - hides new data alert, refreshes list/placeholder/subs

#### `handle_body_keydown(evt)`
Escape key closes all popovers. On any keydown, after 100ms: hides `.no-results` element and blurs subreddit select if dropdown is closed.

#### `show_skeleton_loading()`
Scrolls item_list to top, hides item_list, shows skeleton_list.

#### `hide_skeleton_loading()`
Hides skeleton_list, shows item_list, scrolls item_list to top.

#### `list_next_items(count)`
Fetches the next `count` items from the server. If the current type is `"comments"` and category is `upvoted`/`downvoted`/`hidden`, shows a static message instead. Emits `"get data"` with the current filter, count, and `items_currently_listed` as offset. Awaits `"got data"` response. Renders each item as an HTML list item including: subreddit icon (with border unless `"#"`), sub link, author link, timestamp (Bootstrap tooltip), content (bold for posts, small for comments), and conditionally delete/copy link/text/renew buttons. Attaches IntersectionObserver to the item at index `offset + count - Math.floor(count/2) - 1` to trigger the next load.

#### `refresh_item_list()`
Disconnects intersection observer, clears `item_list` innerHTML and scrollTop, resets `items_currently_listed` to 0, then calls `list_next_items(25)`.

#### `update_search_placeholder()`
Emits `"get placeholder"` with current category/type filter. Awaits `"got placeholder"` response and updates `search_input.placeholder`.

#### `fill_subreddit_select()`
Resets subreddit select to `"all"`. Emits `"get subs"` with current filter. Awaits `"got subs"` response and inserts `<option>` elements. Calls Bootstrap Select `refresh` and `render`.

#### `switch_view_user()`
Guards against switching to the current user or empty selection. Emits `"set view user"` with `selected_user`. On `"view user set"` response: updates `view_username`, `view_user_is_syncing`, `last_updated_epoch`, then refreshes list/placeholder/subs.

### `onMount`
1. Emits `"page" "access"` socket event
2. If `view_username` is set: emits `"set view user"` and awaits `"view user set"` response (prevents race with subsequent data requests)
3. Registers `"store last updated epoch"` listener: updates `last_updated_epoch`
4. Registers `"show refresh alert"` listener: shows new-data alert banner if the affected category matches `active_category`
5. Starts 1-second interval to refresh `last_updated_wrapper_1` (time-since) and `last_updated_wrapper_2` (full datetime). Guards against null DOM refs.
6. Fetches initial item list (25 items), hides skeleton loading, updates placeholder and subreddit select
7. Initializes Bootstrap Select plugin on `subreddit_select`, captures references to `.bs-placeholder` and `.bootstrap-select` elements
8. Registers Bootstrap Select `changed.bs.select` event: updates `active_sub` and refreshes list/placeholder
9. Registers click listener on `last_updated_wrapper_1`: toggles visibility of `last_updated_wrapper_2`
10. Registers click listener on `last_updated_wrapper_2`: toggles its own visibility
11. Registers click listener on subreddit select button: blurs if dropdown is not open
12. Registers `keydown` listener on `search_input`: Enter updates `active_search_str` and refreshes list; Escape clears search; Backspace/Delete clears search if input becomes empty
13. Registers click listener on `search_btn`: dispatches Enter keydown event on search input
14. Registers `scroll` listener on `item_list`: calls debounced hide-popover

### `onDestroy`
Removes `"store last updated epoch"` and `"show refresh alert"` socket listeners. Clears the countdown interval.

## Template
- `<svelte:body>` with `on:click` and `on:keydown` handlers
- `<Navbar>` with `auth_username` and `show_data_anchors={is_own_data}`
- App name `<h1>`
- **User switcher** (shown when `available_users.length > 1 || !auth_username`): `<select>` bound to `selected_user`, lists all users with `(syncing)` indicator; "switch" button disabled when no change
- "viewing: u/{view_username}" with `(read-only)` indicator when `!is_own_data`
- **Last synced** (shown when `last_updated_epoch` is truthy): `last_updated_wrapper_1` (time since), `last_updated_wrapper_2` (full datetime, hidden by default)
- New data alert area (hidden by default)
- **Filter controls card**: category radio buttons (saved/created/upvoted/downvoted/hidden), type radio buttons (posts/comments/all), search input with search button, Bootstrap Select subreddit dropdown
- **Item list card**: scrollable `item_list` (hidden initially), `skeleton_list` with 7 skeleton placeholders (shown initially)
