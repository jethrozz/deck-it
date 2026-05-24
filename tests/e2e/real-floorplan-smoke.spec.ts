import { expect, test } from "@playwright/test";

test("real floor plan can be uploaded and analyzed", async ({ page }) => {
  test.setTimeout(120000);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "AI 设计师" })).toBeVisible();
  await page.getByRole("button", { name: /开始创建/ }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/upload$/);
  await expect(page.getByRole("button", { name: "选择图片" })).toBeEnabled();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "选择图片" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles("/Users/jethrozz/Downloads/户型图-测试.jpg");

  await expect(page).toHaveURL(/\/projects\/.+\/analysis$/, { timeout: 90000 });
  await expect(page.getByText("分析摘要")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("空间组成")).toBeVisible();
  await page.screenshot({ path: "test-results/real-floorplan-analysis-page.png", fullPage: true });
});
