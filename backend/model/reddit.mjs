import snoowrap from "snoowrap";

function create_requester(reddit_api_refresh_token) {
	const requester = new snoowrap({
		clientId: process.env.REDDIT_APP_ID,
		clientSecret: process.env.REDDIT_APP_SECRET,
		userAgent: `web:expanse${(process.env.RUN == "dev" ? "_test" : "")}:v=${process.env.VERSION} (hosted by u/${process.env.REDDIT_USERNAME})`, // https://github.com/reddit-archive/reddit/wiki/API "User-Agent"
		refreshToken: reddit_api_refresh_token
	});
	// Every user shares this clientId, so reddit's rate limit is ONE pool across all
	// accounts, not one per token — observed directly: the remaining count decrements
	// monotonically as a cycle walks from user to user (999 -> 986 -> ... -> 130). A
	// single expensive user therefore starves every other account in the same cycle.
	//
	// SNOOWRAP_DEBUG=true logs each outgoing request URI, which is how you find out where
	// a cycle's budget actually went. Off by default: it is very chatty.
	if (process.env.SNOOWRAP_DEBUG === "true") {
		requester.config({ debug: true });
	}
	return requester;
}

export {
	create_requester
};
