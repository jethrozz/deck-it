import { expect, test } from "@playwright/test";

test("homeowner can start a renovation project", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /上传户型图/ })).toBeVisible();

  await page.getByRole("button", { name: /创建项目/ }).click();

  await expect(page).toHaveURL(/\/projects\/.+/);
  await expect(page.getByRole("heading", { name: /我的装修方案/ })).toBeVisible();
  await expect(page.getByText("上传户型图")).toBeVisible();
  await expect(page.getByText("风格与预算")).toBeVisible();
  await expect(page.getByText("Agent 追问")).toBeVisible();
});
