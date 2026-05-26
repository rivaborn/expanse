import * as xlsx from "xlsx";
import filesystem from "fs";
import child_process from "child_process";
import better_sqlite3 from "better-sqlite3";

const sql = await import(`${process.env.backend}/model/sql.mjs`);
const utils = await import(`${process.env.backend}/model/utils.mjs`);

async function init() {
	for (const dir of [`${process.env.backend}/logs/`, `${process.env.backend}/tempfiles/`, `${process.env.backend}/backups/`]) {
		if (filesystem.existsSync(dir)) {
			if (process.env.RUN == "dev") {
				const files = await filesystem.promises.readdir(dir);
				await Promise.all(files.map((file, idx, arr) => (dir == `${process.env.backend}/logs/` ? filesystem.promises.truncate(`${dir}/${file}`.replace("//", "/"), 0) : filesystem.promises.unlink(`${dir}/${file}`.replace("//", "/")))));
			}
		} else {
			filesystem.mkdirSync(dir);
		}
	}
}

async function parse_import(username, files) {
	const import_data = {
		item_fns: new Set(),
		category_item_ids: {}
	};

	const categories = ["saved", "created", "upvoted", "downvoted", "hidden"];
	for (const category of categories) {
		import_data.category_item_ids[category] = new Set();
	}
	
	for (const file of files) {
		const csv = xlsx.read(file.data, {
			type: "buffer"
		});
		const sheet_list = csv.SheetNames;
		const sheet = csv.Sheets[sheet_list[0]];
		const items = xlsx.utils.sheet_to_json(sheet);

		for (const item of items) {
			if (!item.id.toString().includes(".")) { // exclude anomaly fns: see thread https://www.reddit.com/r/help/comments/rztejh/saved_posts_beyond_the_1000_visible_limit
				switch (file.name) {
					case "saved_posts.csv":
						import_data.item_fns.add(`t3_${item.id}`);
						import_data.category_item_ids.saved.add(item.id);
						break;
					case "saved_comments.csv":
						import_data.item_fns.add(`t1_${item.id}`);
						import_data.category_item_ids.saved.add(item.id);
						break;
					case "posts.csv":
						import_data.item_fns.add(`t3_${item.id}`);
						import_data.category_item_ids.created.add(item.id);
						break;
					case "comments.csv":
						import_data.item_fns.add(`t1_${item.id}`);
						import_data.category_item_ids.created.add(item.id);
						break;
					case "post_votes.csv":
						if (item.direction != "none") {
							import_data.item_fns.add(`t3_${item.id}`);
							import_data.category_item_ids[`${item.direction}voted`].add(item.id);
						}
						break;
					case "hidden_posts.csv":
						import_data.item_fns.add(`t3_${item.id}`);
						import_data.category_item_ids.hidden.add(item.id);
						break;
					default:
						break;
				}
			}
		}
	}

	await sql.parse_import(username, import_data);
}

async function create_sqlite_export() {
	const filename = Math.random().toString().slice(2, 17);
	const filepath = `${process.env.backend}/tempfiles/${filename}.sqlite`;

	const db = better_sqlite3(filepath);
	try {
		db.pragma("journal_mode = WAL");
		db.exec(`
			create table user_ (
				username text primary key,
				reddit_api_refresh_token_encrypted text,
				category_sync_info text,
				last_updated_epoch integer,
				last_active_epoch integer
			);
			create table item (
				id text primary key,
				type text not null,
				content text not null,
				author text not null,
				sub text not null,
				url text not null,
				created_epoch integer not null
			);
			create table item_fn_to_import (
				id text primary key,
				fn_prefix text not null
			);
			create table user_item (
				username text not null,
				category text not null,
				item_id text not null,
				added_epoch integer,
				unique (username, category, item_id)
			);
			create table item_sub_icon_url (
				sub text primary key,
				url text not null
			);
		`);

		const tables = [
			{ name: "user_", cols: ["username", "reddit_api_refresh_token_encrypted", "category_sync_info", "last_updated_epoch", "last_active_epoch"], int_cols: new Set(["last_updated_epoch", "last_active_epoch"]) },
			{ name: "item", cols: ["id", "type", "content", "author", "sub", "url", "created_epoch"], int_cols: new Set(["created_epoch"]) },
			{ name: "item_fn_to_import", cols: ["id", "fn_prefix"], int_cols: new Set() },
			{ name: "user_item", cols: ["username", "category", "item_id", "added_epoch"], int_cols: new Set(["added_epoch"]) },
			{ name: "item_sub_icon_url", cols: ["sub", "url"], int_cols: new Set() }
		];

		for (const tbl of tables) {
			const result = await sql.pool.query(`select ${tbl.cols.join(", ")} from ${tbl.name};`);
			const placeholders = tbl.cols.map(() => "?").join(", ");
			const stmt = db.prepare(`insert into ${tbl.name} (${tbl.cols.join(", ")}) values (${placeholders})`);
			const insert_many = db.transaction((rows) => {
				for (const row of rows) {
					const vals = tbl.cols.map((c) => {
						const v = row[c];
						if (v === null || v === undefined) return null;
						if (tbl.int_cols.has(c)) return (typeof v === "string" ? Number(v) : v);
						if (typeof v === "object") return JSON.stringify(v);
						return v;
					});
					stmt.run(vals);
				}
			});
			insert_many(result.rows);
		}
	} finally {
		db.close();
	}

	setTimeout(() => {
		filesystem.promises.unlink(filepath).catch((err) => null);
	}, 14400000); // 4h

	return filename;
}

async function create_export(username) {
	const export_data = {};
	const categories = ["saved", "created", "upvoted", "downvoted", "hidden"];
	for (const category of categories) {
		const filter = {
			category: category,
			type: "all",
			sub: "all",
			search_str: ""
		};
		export_data[category] = await sql.get_data(username, filter, "all", 0);
	}

	const filename = Math.random().toString().slice(2, 17);
	await filesystem.promises.writeFile(`${process.env.backend}/tempfiles/${filename}.json`, JSON.stringify(export_data, null, 4), "utf-8");

	setTimeout(() => {
		filesystem.promises.unlink(`${process.env.backend}/tempfiles/${filename}.json`).catch((err) => null);
	}, 14400000); // 4h
	
	return filename;
}

async function delete_oldest_if_reached_limit(limit, dir, what) {
	const files = await filesystem.promises.readdir(dir);
	if (files.length > limit) {
		let oldest_file = null;
		let oldest_file_ctime = null;
		for (const file of files) {
			const stats = await filesystem.promises.stat(`${dir}/${file}`.replace("//", "/"));
			const ctime = stats.ctime;
			if (!oldest_file || ctime < oldest_file_ctime) {
				oldest_file = file;
				oldest_file_ctime = ctime;
			}
		}
		await filesystem.promises.unlink(`${dir}/${oldest_file}`.replace("//", "/"));
		console.log(`deleted oldest ${what} (${oldest_file}) past limit (${limit})`);
	}
}

function backup_db() {
	const filename = utils.epoch_to_formatted_datetime(utils.now_epoch()).replaceAll(":", "꞉").split(" ").join("_");

	const spawn = child_process.spawn("pg_dump", [
		"-O", "-d", sql.pool.options.connectionString, "-f", `${process.env.backend}/backups/${filename}.sql`
	]);

	spawn.stderr.on("data", (data) => {
		const stderr = data.toString();
		console.error(stderr);
	});

	spawn.stdout.on("data", (data) => {
		const stdout = data.toString();
		(stdout != "\n" ? console.log(stdout) : null);
	});

	spawn.on("exit", (exit_code) => {
		if (exit_code == 0) {
			console.log(`backed up db to file (${filename}.sql)`);

			delete_oldest_if_reached_limit(5, `${process.env.backend}/backups/`, "db backup").catch((err) => console.error(err));
		} else {
			console.error(`db backup process exited with code ${exit_code}`);
		}
	});
}
function cycle_backup_db() {
	(process.env.RUN == "dev" ? backup_db() : null);

	setInterval(() => {
		backup_db();
	}, 86400000); // 24h
}

export {
	init,
	parse_import,
	create_export,
	create_sqlite_export,
	cycle_backup_db
};
