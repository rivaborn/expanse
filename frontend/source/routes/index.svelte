<script context="module">
	import * as globals from "frontend/source/globals.js";
	import Landing from "frontend/source/components/landing.svelte";
	import Loading from "frontend/source/components/loading.svelte";
	import Access from "frontend/source/components/access.svelte";

	import * as svelte from "svelte";
	import axios from "axios";

	let _auth_username = null;
	let _view_username = null;
	let _available_users = [];
	let _online_users = [];

	const globals_r = globals.readonly;

	export async function load(obj) {
		try {
			const [auth_response, users_response] = await Promise.all([
				axios.get(`${globals_r.backend}/authentication_check?socket_id=${globals_r.socket.id}`),
				axios.get(`${globals_r.backend}/get_users`)
			]);
			const auth_data = auth_response.data;
			const users_data = users_response.data;

			_auth_username = auth_data.username || null;
			_view_username = _auth_username;
			_available_users = users_data.usernames || [];
			_online_users = users_data.online_usernames || [];

			return {
				status: 200,
				props: {
					use_page: auth_data.use_page
				}
			};
		} catch (err) {
			console.error(err);

			if (Number.parseInt(err.message.split(" ").slice(-1)[0]) == 401) { // backend deserializeUser error
				return {
					status: 401
				};
			} else { // get request failed
				return {
					status: 503
				};
			}
		}
	};
</script>
<script>
	export let use_page;

	let active_page = null;
	let auth_username = _auth_username;
	let view_username = _view_username;
	let available_users = _available_users;
	let online_users = _online_users;

	function handle_component_dispatch(evt) {
		switch (evt.detail.action || evt.detail) {
			case "switch page to loading":
				active_page = Loading;
				break;
			case "switch page to access":
				active_page = Access;
				break;
			case "set view user":
				view_username = evt.detail.username;
				active_page = Access;
				break;
			default:
				break;
		}
	}

	switch (use_page) {
		case "landing":
			active_page = Landing;
			break;
		case "loading":
			active_page = Loading;
			break;
		case "access":
			active_page = Access;
			break;
		default:
			break;
	}

	svelte.onMount(() => {
		if (window.location.href.endsWith("/#_")) { // from reddit oauth callback
			window.history.pushState(null, "", window.location.href.slice(0, -3));
		}

		globals_r.socket.emit("route", "index");
	});
</script>

<svelte:head>
	<title>{globals_r.app_name}</title>
	<meta name="description" content={globals_r.description}/>
</svelte:head>
<svelte:component this={active_page} on:dispatch={handle_component_dispatch} {auth_username} {view_username} {available_users} {online_users}/>
