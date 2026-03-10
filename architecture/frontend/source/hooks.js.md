# hooks.js - SvelteKit Hooks

## Overview
SvelteKit server hooks that configure global request handling. This is the only hook file in the project.

## Functions

### `handle(obj)`
The SvelteKit `handle` hook. Resolves all requests with `ssr: false`, disabling server-side rendering entirely. This makes the app a pure client-side SPA — all page rendering happens in the browser. The `obj` parameter contains `resolve` and `event` from SvelteKit's hook API.

Returns the resolved response.
