# utils.js - Frontend Utility Functions

## Overview
Client-side utility functions for time formatting and UI effects.

## Functions

### `epoch_to_formatted_datetime(epoch)`
Converts a Unix epoch (seconds) to a formatted datetime string in "DD-MM-YYYY HH:MM:SS:AM/PM UTC" format. Same logic as backend `utils.mjs`.

### `time_since(epoch)`
Returns a human-readable relative time string (e.g., "5m", "2h", "3d", "1y"). Used for the "last synced: X ago" display.

### `shake_element(element)`
Adds a CSS "shake" animation class to a DOM element for 300ms. Used for input validation feedback (e.g., incorrect purge confirmation).

### `show_alert(alert_wrapper, message, type)`
Renders a Bootstrap alert inside the given wrapper element. `type` maps to Bootstrap alert classes (primary, danger, etc.).
