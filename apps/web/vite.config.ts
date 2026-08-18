import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // Silently activates a new service worker as soon as one finishes
      // installing, instead of leaving the old one in control until every
      // tab closes — a manual "update available" prompt is more correct
      // but is real UI work; autoUpdate is the right default until that's
      // asked for.
      registerType: "autoUpdate",
      includeAssets: ["brand/favicon.ico", "brand/icon-tote-mono.svg"],
      manifest: {
        name: "ShelfSense",
        short_name: "ShelfSense",
        description: "Track what's on your shelves, what's running low, and what's about to expire.",
        // apps/web/index.html defaults to dark mode (see its comment on
        // html.class="dark") — match that here so the install prompt and
        // splash screen don't flash light before the app itself loads.
        theme_color: "#167d76",
        background_color: "#14181b",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Default generateSW behavior precaches every built asset (JS,
        // CSS, index.html, icons) so the app shell loads offline. On top
        // of that: GET /api/* is NetworkFirst — always prefer a live
        // answer, but fall back to the last-seen response when offline
        // instead of a hard failure. This is deliberately not full
        // offline read/write support (no queued mutations, no background
        // sync) — just enough that a flaky connection or a closed laptop
        // lid doesn't blank the screen.
        runtimeCaching: [
          {
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith("/api/"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 4,
              cacheableResponse: { statuses: [0, 200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
        ],
      },
      devOptions: {
        // Registers the service worker under `vite dev` too, not just the
        // production build — otherwise the only way to see any of this
        // working is a full build + preview.
        enabled: true,
        type: "module",
      },
    }),
  ],
  server: {
    port: 5173,
  },
});
