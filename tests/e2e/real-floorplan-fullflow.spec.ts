import { expect, test } from "@playwright/test";

test("real floor plan can finish the guided flow", async ({ page }) => {
  test.setTimeout(360000);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "AI 设计师" })).toBeVisible();
  await page.getByRole("button", { name: /开始创建/ }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/upload$/);
  await expect(page.getByRole("button", { name: "选择图片" })).toBeEnabled();

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "选择图片" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles("/Users/jethrozz/Downloads/户型图-测试.jpg");

  await expect(page).toHaveURL(/\/projects\/.+\/analysis$/, { timeout: 120000 });
  await expect(page.getByText("分析摘要")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: /确认并继续/ })).toBeEnabled();
  await page.getByRole("button", { name: /确认并继续/ }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/preferences$/, { timeout: 15000 });
  const mobileStylePicker = page.getByTestId("style-picker-trigger");
  if (await mobileStylePicker.isVisible().catch(() => false)) {
    await mobileStylePicker.click();
    await expect(page.getByTestId("style-picker-modal")).toBeVisible();
    await page.getByTestId("style-picker-slider").getByRole("button", { name: "现代简约" }).click();
    await page.getByRole("button", { name: "确认风格" }).click();
    await page.getByTestId("budget-tier-select").selectOption("quality");
  } else {
    await expect(page.getByText("选择你喜欢的风格")).toBeVisible();
    await page.getByRole("button", { name: "现代简约" }).click();
    await page.getByRole("button", { name: "品质型 15-25 万" }).click();
  }
  await page
    .getByPlaceholder("例如：希望客厅更显大，好打理；次卧兼顾书房；需要更多收纳；家里有孩子。")
    .fill("一家三口居住，希望客厅显大，保留三房功能，其中一个次卧兼顾书房和临时客房。");
  await page.getByRole("button", { name: /保存并继续/ }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/interview$/, { timeout: 30000 });
  await expect(page.getByText("AI 设计师")).toBeVisible();

  const answers = [
    "建筑面积 98 平左右，想优先让客餐厅更通透，次卧保留卧室功能但加一张书桌。",
    "两个卫生间都保留，收纳希望多一些，阳台想兼顾洗烘。",
    "可以接受把南向阳台和客餐厅做更强的一体化，但希望保留晾晒和洗烘位置。",
    "主卧希望稳重一点，另一个次卧更偏灵活，可以兼顾客房和阅读。",
    "更在意收纳、动线和日常打理，不追求复杂造型。"
  ];

  const chatInput = page.getByPlaceholder("输入你的想法，比如‘次卧平时不住人，希望能兼顾书房和收纳’");
  const sendButton = page.getByRole("button", { name: /发送回答/ });
  const pendingIndicator = page.getByText("设计师正在判断下一步...");
  const optionButtons = page.locator('button[type="button"]');

  await expect(pendingIndicator).toBeVisible({ timeout: 30000 });
  await expect(pendingIndicator).toBeHidden({ timeout: 120000 });

  for (const answer of answers) {
    if (!page.url().includes("/interview")) {
      break;
    }

    await expect(pendingIndicator).toBeHidden({ timeout: 120000 });

    if ((await optionButtons.count()) > 0 && (await optionButtons.first().isVisible().catch(() => false))) {
      await optionButtons.first().click();
    } else {
      await chatInput.fill(answer);
    }

    await expect(sendButton).toBeEnabled({ timeout: 10000 });
    await sendButton.click();

    await expect(pendingIndicator).toBeVisible({ timeout: 10000 });
    await expect(pendingIndicator).toBeHidden({ timeout: 120000 });
  }

  await expect(page).toHaveURL(/\/projects\/.+\/generating$/, { timeout: 60000 });
  await expect(page.getByText("生成预览")).toBeVisible();

  await expect(page).toHaveURL(/\/projects\/.+\/complete$/, { timeout: 240000 });
  await expect(page.getByRole("heading", { name: "方案已生成完成" })).toBeVisible({ timeout: 10000 });

  await page.screenshot({ path: "test-results/real-floorplan-complete-page.png", fullPage: true });
});
