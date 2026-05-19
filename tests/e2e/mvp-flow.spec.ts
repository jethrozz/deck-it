import { expect, test } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
  "base64"
);

test("homeowner can finish the guided renovation flow", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "AI 设计师" })).toBeVisible();
  await page.getByRole("button", { name: /开始创建/ }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/upload$/);
  await expect(page.getByRole("heading", { name: "上传户型图" })).toBeVisible();
  await expect(page.getByRole("button", { name: "选择图片" })).toBeEnabled();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "选择图片" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "floor-plan.png",
    mimeType: "image/png",
    buffer: onePixelPng
  });

  await expect(page).toHaveURL(/\/projects\/.+\/analysis$/, { timeout: 15000 });
  await expect(page.getByText("分析摘要")).toBeVisible();
  await expect(page.getByRole("button", { name: /确认并继续/ })).toBeEnabled();
  await page.getByRole("button", { name: /确认并继续/ }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/preferences$/);
  await expect(page.getByText("选择你喜欢的风格")).toBeVisible();
  await page.getByRole("button", { name: "现代简约" }).click();
  await page.getByRole("button", { name: "品质型 15-25 万" }).click();
  await page
    .getByPlaceholder("例如：希望客厅更显大，好打理；次卧兼顾书房；需要更多收纳；家里有孩子。")
    .fill("一家三口居住，希望客厅显大，次卧兼顾书房和临时客房。");
  await expect(page.getByRole("button", { name: /保存并继续/ })).toBeEnabled();
  await page.getByRole("button", { name: /保存并继续/ }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/interview$/);
  await expect(page.getByText("AI 设计师")).toBeVisible();
  await expect(page.getByText(/我看这个户型的客餐厅连接阳台/)).toBeVisible();

  await page
    .getByPlaceholder("输入你的想法，比如‘次卧平时不住人，希望能兼顾书房和收纳’")
    .fill("希望次卧平时作为书房，需要一张大书桌和临时客房功能。");
  await page.getByRole("button", { name: /发送回答/ }).click();
  await expect(page.getByText(/还有没有需要兼顾的收纳、办公或儿童活动需求/)).toBeVisible();

  await page
    .getByPlaceholder("输入你的想法，比如‘次卧平时不住人，希望能兼顾书房和收纳’")
    .fill("还想增加玄关收纳，儿童活动最好在客厅。");
  await page.getByRole("button", { name: /发送回答/ }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/generating$/);
  await expect(page.getByText("生成预览")).toBeVisible();

  await expect(page).toHaveURL(/\/projects\/.+\/complete$/, { timeout: 20000 });
  await expect(page.getByRole("heading", { name: "方案已生成完成" })).toBeVisible();

  await page.goto(page.url().replace(/\/complete$/, "/brief"));
  await expect(page).toHaveURL(/\/projects\/.+\/brief$/);
  await expect(page.getByText("方案概览")).toBeVisible();
  await expect(page.getByText("重点空间方案")).toBeVisible();
});
