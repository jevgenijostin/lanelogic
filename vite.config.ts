import { defineConfig } from "vite";
export default defineConfig({
  base: process.env.GITHUB_PAGES ? "/lanelogic/" : "/",
  build: {
    rollupOptions: { input: { app: "index.html", engine: "engine.html" } },
  },
});
