import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The app imports the sample data from ../shared, so the dev server is allowed to read the parent folder.
export default defineConfig({
  plugins: [react()],
  server: { fs: { allow: [".."] } },
});
