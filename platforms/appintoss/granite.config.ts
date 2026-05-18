import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
	appName: "<appName>",
	brand: {
		displayName: "<displayName>",
		primaryColor: "#3182F6",
		icon: "<icon>",
	},
	web: {
		host: "127.0.0.1",
		port: 5173,
		commands: {
			dev: "vite --host",
			build: "vite build --outDir dist/web",
		},
	},
	permissions: [],
	outdir: "dist",
});
