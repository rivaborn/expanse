# reddit.mjs - Reddit API Client Factory

## Overview
Simple module that creates and configures snoowrap requester instances for Reddit API access.

## Functions

### `create_requester(reddit_api_refresh_token)`
Creates a new snoowrap instance configured with:
- `clientId` - From `REDDIT_APP_ID` env var
- `clientSecret` - From `REDDIT_APP_SECRET` env var
- `userAgent` - Format: `web:expanse[_test]:v={VERSION} (hosted by u/{REDDIT_USERNAME})`
- `refreshToken` - The decrypted Reddit OAuth2 refresh token

Returns the configured snoowrap requester for making Reddit API calls.
