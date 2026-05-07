import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  output: "static",
  integrations: [mdx(), react()],
  vite: {
    plugins: [tailwindcss()],
  },
  site: "https://cambio-game.com",
});
