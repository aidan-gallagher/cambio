import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  adapter: cloudflare(),
  integrations: [mdx(), react()],
  vite: {
    plugins: [tailwindcss()],
  },
  site: "https://cambio.example.com",
});
