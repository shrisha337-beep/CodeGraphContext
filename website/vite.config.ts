import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/api/github-zip": {
        target: "https://codeload.github.com",
        changeOrigin: true,
        rewrite: (path) => {
          const match = path.match(/^\/api\/github-zip\/([^\/]+)\/([^\/]+)\/([^\/]+)/);
          if (match) {
            const [_, owner, repo, branch] = match;
            return `/${owner}/${repo}/legacy.zip/${branch}`;
          }
          return path;
        },
      },
      "/api/pypi": {
        target: "https://pypistats.org",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pypi/, "/api"),
      },
    },
  },
  plugins: [react()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  worker: {
    format: "es",
  },
}));
