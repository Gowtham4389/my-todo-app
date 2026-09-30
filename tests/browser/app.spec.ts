import { test, expect } from "@playwright/test";
async function demo(page: import("@playwright/test").Page) {
  await page.goto("./");
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page.getByRole("heading", { name: "Today." })).toBeVisible();
}
test("desktop tasks, details, undo, Trash, and nested route reload", async ({
  page,
}) => {
  await demo(page);
  await page
    .getByRole("textbox", { name: "Quick add task" })
    .fill("A task from a browser test");
  await page.getByRole("button", { name: "Create quick task" }).click();
  await page
    .getByRole("button", { name: /^A task from a browser test/ })
    .click();
  await page.getByLabel("Notes", { exact: true }).fill("Meaningful details");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", {
      name: "Complete A task from a browser test",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Reopen A task from a browser test",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Complete A task from a browser test",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /^A task from a browser test/ })
    .click();
  await page.getByRole("button", { name: "Move to trash" }).click();
  await page.getByRole("link", { name: "Trash", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Restore A task from a browser test",
      exact: true,
    })
    .click();
  await page.getByRole("link", { name: "This week" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page.getByRole("heading", { name: "Your week." })).toBeVisible();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Complete A task from a browser test",
      exact: true,
    }),
  ).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: "test-results/desktop.png", fullPage: true });
});
test("mobile navigation, accessible task dialog, and no horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await demo(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Add task", exact: true })
    .filter({ visible: true })
    .click();
  await page
    .getByRole("textbox", { name: "Task title" })
    .fill("Mobile intention");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Complete Mobile intention",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("button", { name: "Year & goals", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "The bigger picture." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page
    .getByRole("link", { name: "Today", exact: true })
    .filter({ visible: true })
    .click();
  await page.screenshot({ path: "test-results/mobile.png", fullPage: true });
});
test("JSON export, validated preview and duplicate-free reimport", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export full JSON backup" }).click();
  const file = await downloadEvent;
  const path = await file.path();
  await page.getByLabel("Import JSON backup").setInputFiles(path!);
  await expect(
    page.getByText(/0 added · 0 updated · 12 skipped/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Merge backup" }).click();
  await expect(
    page.getByText("Backup merged. Existing settings were preserved."),
  ).toBeVisible();
  await page.getByLabel("Appearance").selectOption("dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});
test("offline app shell reload from installed service worker", async ({
  page,
  context,
}) => {
  await demo(page);
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await context.setOffline(true);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /Make room for/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(page.getByRole("heading", { name: "Today." })).toBeVisible();
});

test("recurring occurrences stay independent, and goals link to the same task", async ({
  page,
}) => {
  await demo(page);
  await page.getByRole("link", { name: "This year", exact: true }).click();
  await page.getByRole("button", { name: "New goal", exact: true }).click();
  await page
    .getByLabel("Goal", { exact: true })
    .fill("Learn something every day");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill("Daily learning ritual");
  await page
    .getByRole("combobox", { name: "Repeat", exact: true })
    .selectOption("daily");
  await page
    .getByRole("combobox", { name: "Larger goal", exact: true })
    .selectOption({
      label: `Learn something every day · ${new Date().getFullYear()}`,
    });
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Complete Daily learning ritual",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Next period" }).click();
  await expect(
    page.getByRole("button", {
      name: "Complete Daily learning ritual",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous period" }).click();
  await expect(
    page.getByRole("button", {
      name: "Reopen Daily learning ritual",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "This year", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Learn something every day/ }),
  ).toContainText("1 of 1 linked tasks complete");
});

test("permanent deletion clears every view, Undo, and persists after reload", async ({
  page,
}) => {
  await demo(page);
  const title = "Permanently removed task";
  await page.getByRole("textbox", { name: "Quick add task" }).fill(title);
  await page.getByRole("button", { name: "Create quick task" }).click();
  await page
    .getByRole("button", { name: `Complete ${title}`, exact: true })
    .click();
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  page.once("dialog", (dialog) => dialog.dismiss());
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: "Delete permanently", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Undo", exact: true }),
  ).toHaveCount(0);
  for (const view of [
    "This week",
    "This month",
    "This year",
    "Completed",
    "Trash",
    "Inbox",
  ]) {
    await page.getByRole("link", { name: view, exact: true }).click();
    await expect(
      page.getByRole("button", { name: new RegExp(title) }),
    ).toHaveCount(0);
  }
  await page.reload();
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toHaveCount(0);
});
test("permanently deleting a recurring occurrence from Trash does not recreate it", async ({
  page,
}) => {
  await demo(page);
  const title = "Recurring deletion check";
  await page.getByRole("button", { name: "Add task", exact: true }).click();
  await page.getByLabel("Task title").fill(title);
  await page
    .getByRole("combobox", { name: "Repeat", exact: true })
    .selectOption("daily");
  await page.getByRole("button", { name: "Create task", exact: true }).click();
  await page.getByRole("button", { name: new RegExp(`^${title}`) }).click();
  await page
    .getByRole("button", { name: "Move to trash", exact: true })
    .click();
  await page.getByRole("link", { name: "Trash", exact: true }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Permanently delete ${title}`, exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Today", exact: true }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toHaveCount(0);
  await page.reload();
  await page.getByRole("button", { name: "Explore the demo" }).click();
  await expect(
    page.getByRole("button", { name: new RegExp(title) }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Next period", exact: true }).click();
  await expect(
    page.getByRole("button", { name: `Complete ${title}`, exact: true }),
  ).toBeVisible();
});
