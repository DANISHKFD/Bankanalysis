import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

// One self-contained HTML file: build_report.py injects the data and publishes it.
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { outDir: "dist", assetsInlineLimit: 100000000, cssCodeSplit: false },
});
