import { execFileSync } from "node:child_process";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const gitVersion = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  publicDir: fileURLToPath(new URL("../public", import.meta.url)),
  plugins: [react(), tailwindcss()],
  define: {
    "import.meta.env.VITE_GIT_VERSION": JSON.stringify(gitVersion),
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env.NULLNOTE_VERSION || "1.0.1"),
  },
  resolve: { alias: { "@": fileURLToPath(new URL("../src", import.meta.url)) } },
  build: {
    outDir: process.env.NULLNOTE_DESKTOP_OUT || "../electron-release/client",
    emptyOutDir: true,
    rollupOptions: { input: fileURLToPath(new URL("client.html", import.meta.url)) },
  },
});