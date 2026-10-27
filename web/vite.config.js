import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app imports the sample data from ../shared, so the dev server is allowed to read the parent folder.
// During development, /api calls are forwarded to the Worker running locally on port 8787.
export default defineConfig({
  plugins: [react()],
  server: {
    fs: { allow: [".."] },
    proxy: { "/api": "http://localhost:8787" },
  },
});
