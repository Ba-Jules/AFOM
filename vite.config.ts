import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // IMPORTANT pour GitHub Pages (repo ba-jules/AFOM)
  base: "/AFOM/",
  plugins: [react()],
  build: {
    outDir: "dist"
  }
});

