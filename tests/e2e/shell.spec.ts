import { test, expect } from "@playwright/test";

test("shell loads, navigates and shows honest empty state", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Expose your PC" })).toBeVisible();
  await page.getByRole("button", { name: "EXPOSE MY PC" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Investigation" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("needs the desktop app");
  await page.getByRole("button", { name: "Settings" }).click();
  await expect(page.getByTestId("app-version")).toContainText("0.1.0-beta.1");
});
