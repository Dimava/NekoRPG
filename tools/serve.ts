import { resolve, sep } from "node:path";

const root = resolve(import.meta.dir, "..");

const server = Bun.serve({
	port: 4173,
	fetch(request) {
		const path = decodeURIComponent(new URL(request.url).pathname);
		const file_path = resolve(root, "." + (path.endsWith("/") ? path + "index.html" : path));
		if (file_path !== root && !file_path.startsWith(root + sep)) {
			return new Response("Forbidden", { status: 403 });
		}
		return new Response(Bun.file(file_path));
	},
});

console.log(`serving ${root} on ${server.url}`);
