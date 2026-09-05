import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

// Plain Vite + React SPA. `vite build` emits a fully static bundle to dist/,
// which Vercel serves with a SPA fallback (see vercel.json) so client-side
// routes such as /app resolve without a server.
export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
  server: {
    host: true,
    port: 8080,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
