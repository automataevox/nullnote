// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import packageJson from "./package.json";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const gitVersion = execFileSync("git", ["rev-parse", "--short", "HEAD"], { encoding: "utf8" }).trim();
const httpsCert = process.env["NULLNOTE_HTTPS_CERT"];
const httpsKey = process.env["NULLNOTE_HTTPS_KEY"];

if (!!httpsCert !== !!httpsKey) {
  throw new Error("Set both NULLNOTE_HTTPS_CERT and NULLNOTE_HTTPS_KEY to enable HTTPS.");
}

export default defineConfig({
  vite: {
    define: {
      "import.meta.env.VITE_GIT_VERSION": JSON.stringify(gitVersion),
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(process.env["NULLNOTE_VERSION"] || packageJson.version),
    },
    ...(httpsCert && httpsKey
      ? {
          server: {
            https: {
              cert: readFileSync(httpsCert),
              key: readFileSync(httpsKey),
            },
          },
        }
      : {}),
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
