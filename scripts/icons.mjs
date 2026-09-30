import { chromium } from "@playwright/test";
const browser = await chromium.launch({ channel: "chrome" });
for (const size of [192, 512]) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  await page.setContent(
    `<html><body style="margin:0;background:#2C92B8"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2C92B8"/><path d="M20 21h12c17 0 17 23 0 23H20V21Z" fill="none" stroke="#fff" stroke-width="4"/><path d="m25 32 5 5 12-14" fill="none" stroke="#fff" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></body></html>`,
  );
  await page.screenshot({ path: `public/icon-${size}.png` });
  await page.close();
}
await browser.close();
