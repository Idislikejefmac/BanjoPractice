/// <reference types="vitest/config" />
import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
import { VitePWA } from "vite-plugin-pwa";

const pkg = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as {
  version: string;
};

// BASE_PATH is set by the deploy workflow, e.g. "/BanjoProject/" for production and
// "/BanjoProject/staging/" for staging. Locally it is "/".
const base = process.env.BASE_PATH ?? "/";
const isStaging = base.endsWith("/staging/");

export default defineConfig(({ mode }) => ({
  base,
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify((process.env.GITHUB_SHA ?? "dev").slice(0, 7)),
    __BUILD_CHANNEL__: JSON.stringify(
      isStaging ? "staging" : mode === "chaos" ? "chaos" : "production",
    ),
  },
  plugins: [
    preact(),
    VitePWA({
      // "prompt" + never prompting = a new version waits and activates on the next cold
      // launch (DEVELOPMENT.md P4: no update banner).
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        name: "Banjo Practice",
        short_name: "Banjo",
        description: "Scruggs-style banjo practice: tab, notation and playback.",
        start_url: base,
        scope: base,
        display: "standalone",
        orientation: "any",
        background_color: "#fbf8f1",
        theme_color: "#3b2a1a",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          {
            src: "icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Instrument samples are precached too, so playback works offline from the first
        // launch (about 3.6 MB; DEVELOPMENT.md A2).
        globPatterns: ["**/*.{js,css,html,svg,png,woff2,mp3}"],
        // The production service worker's scope covers /staging/ too; never let it answer
        // staging navigations (staging registers its own, more specific worker).
        navigateFallbackDenylist: isStaging ? [] : [/\/staging\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: {
    target: "es2022",
    sourcemap: true,
    // abcjs is most of the bundle; its own chunk caches separately from app updates.
    rollupOptions: { output: { manualChunks: { abcjs: ["abcjs"] } } },
    chunkSizeWarningLimit: 600,
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/property/**/*.test.ts"],
    environment: "node",
  },
}));
