import { defineConfig } from "@playwright/test";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4173";
const previewURL = new URL(baseURL);
const port = Number(previewURL.port) || 4173;
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  use: { baseURL, channel: "chrome", headless: true },
  webServer: {
    command: `npm run preview -- --host 127.0.0.1 --port ${port} --base ${previewURL.pathname}`,
    port,
    reuseExistingServer: false,
  },
  reporter: "list",
});
