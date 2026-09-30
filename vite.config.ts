import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const base = process.env.VITE_BASE_PATH || env.VITE_BASE_PATH || "/";
  return {
    base,
    plugins: [
      react(),
      VitePWA({
        registerType: "prompt",
        injectRegister: "auto",
        includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
        manifest: {
          name: "Daymark — A little more intentional",
          short_name: "Daymark",
          description:
            "Your goals, plans, and everyday progress, in one calm place.",
          theme_color: "#50755e",
          background_color: "#f8f9f5",
          display: "standalone",
          scope: base,
          start_url: base,
          icons: [
            { src: "icon-192.png", sizes: "192x192", type: "image/png" },
            {
              src: "icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,webmanifest}"],
          navigateFallback: `${base}index.html`,
          cleanupOutdatedCaches: true,
          maximumFileSizeToCacheInBytes: 3_000_000,
        },
      }),
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: (id: string) =>
            id.includes("@firebase") || id.includes("/firebase/")
              ? "firebase"
              : undefined,
        },
      },
    },
  };
});
