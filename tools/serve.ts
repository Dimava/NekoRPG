import { mkdir } from "node:fs/promises";
import { resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "..");
const save_file = resolve(root, "saves", "cloud.json");

const server = Bun.serve({
	port: 4173,
	async fetch(request) {
		const url = new URL(request.url);
		if (url.pathname === "/api/save") {
			if (request.method === "GET") {
				const file = Bun.file(save_file);
				if (!(await file.exists())) {
					return new Response("", { status: 204 });
				}
				return new Response(file, {
					headers: { "content-type": "application/json" },
				});
			}
			if (request.method === "PUT" || request.method === "POST") {
				const body = await request.text();
				try {
					JSON.parse(body);
				} catch {
					return new Response("Invalid save", { status: 400 });
				}
				await mkdir(resolve(root, "saves"), { recursive: true });
				await Bun.write(save_file, body);
				return new Response("ok");
			}
			return new Response("Method Not Allowed", { status: 405 });
		}

		const path = decodeURIComponent(url.pathname);
		const file_path = resolve(root, "." + (path.endsWith("/") ? path + "index.html" : path));
		if (file_path !== root && !file_path.startsWith(root + sep)) {
			return new Response("Forbidden", { status: 403 });
		}
		return new Response(Bun.file(file_path));
	},
});

console.log(`serving ${root} on ${server.url}`);
