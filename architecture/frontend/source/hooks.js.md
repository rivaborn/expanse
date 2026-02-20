# hooks.js - SvelteKit Hooks

## Overview
SvelteKit server hooks that configure request handling.

## Functions

### `handle(obj)`
The SvelteKit handle hook. Resolves all requests with `ssr: false`, disabling server-side rendering. This makes the app a pure client-side SPA.
