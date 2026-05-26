<script context="module">
	import * as globals from "frontend/source/globals.js";
	import * as utils from "frontend/source/utils.js";

	import * as svelte from "svelte";
	import axios from "axios";

	const globals_r = globals.readonly;
</script>
<script>
	let users = [];
	let online_usernames = [];
	let tick = 0;
	let tick_interval_id = null;

	async function load_users() {
		try {
			const response = await axios.get(`${globals_r.backend}/get_users`);
			users = response.data.users || [];
			online_usernames = response.data.online_usernames || [];
		} catch (err) {
			console.error(err);
		}
	}

	$: rows = (() => {
		void tick;
		const online_set = new Set(online_usernames);
		return users.map((u) => ({
			username: u.username,
			when: (u.last_updated_epoch ? `${utils.time_since(u.last_updated_epoch)} ago` : "never"),
			online: online_set.has(u.username)
		}));
	})();

	svelte.onMount(() => {
		load_users();

		globals_r.socket.on("users updated", load_users);

		tick_interval_id = setInterval(() => {
			tick++;
		}, 1000);
	});
	svelte.onDestroy(() => {
		globals_r.socket.off("users updated", load_users);
		clearInterval(tick_interval_id);
	});
</script>

{#if rows.length > 0}
	<div class="card bg-dark text-light border-secondary mt-4 mb-3">
		<div class="card-body p-2">
			<h6 class="text-center mb-2">logged in users</h6>
			<table class="table table-sm table-dark mb-0">
				<thead>
					<tr>
						<th scope="col">user</th>
						<th scope="col">status</th>
						<th scope="col">last updated</th>
					</tr>
				</thead>
				<tbody>
					{#each rows as r (r.username)}
						<tr>
							<td>u/{r.username}</td>
							<td>{r.online ? "syncing" : "not syncing"}</td>
							<td>{r.when}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/if}
