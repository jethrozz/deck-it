import { chromium } from "playwright";
import type { DesignPlan, FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

export type BriefPdfInput = {
  projectName: string;
  analysis: FloorPlanAnalysis;
  profile: PreferenceProfile;
  plan: DesignPlan;
  renderings: Array<{ spaceType: string; imageUrl: string | null }>;
};

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function buildBriefHtml(input: BriefPdfInput) {
  const spaces = input.plan.keySpaces
    .map((space) => {
      const rendering = input.renderings.find((item) => item.spaceType === space.spaceType);
      const image = rendering?.imageUrl
        ? `<img src="${escapeHtml(rendering.imageUrl)}" alt="${escapeHtml(space.title)}" />`
        : "<p>效果图生成中或生成失败。</p>";

      return `
        <section>
          <h2>${escapeHtml(space.title)}</h2>
          ${image}
          <p><strong>设计目标：</strong>${escapeHtml(space.designGoal)}</p>
          <p>${escapeHtml(space.explanation)}</p>
          <p><strong>布局建议：</strong>${escapeHtml(space.layoutSuggestion)}</p>
          <p><strong>预算取舍：</strong>${escapeHtml(space.budgetTradeOffs)}</p>
        </section>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            font-family: Arial, "PingFang SC", sans-serif;
            color: #20201d;
            line-height: 1.65;
            padding: 32px;
          }
          h1 { font-size: 28px; }
          h2 { margin-top: 28px; font-size: 20px; }
          img {
            width: 100%;
            max-height: 420px;
            object-fit: cover;
            border-radius: 6px;
          }
          section {
            break-inside: avoid;
            border-top: 1px solid #ddd6c8;
            padding-top: 16px;
          }
        </style>
      </head>
      <body>
        <h1>${escapeHtml(input.projectName)} 装修设计 Brief</h1>
        <p><strong>风格：</strong>${escapeHtml(input.profile.style)}</p>
        <p><strong>预算档位：</strong>${escapeHtml(input.profile.budgetTier)}</p>
        <p><strong>用户需求：</strong>${escapeHtml(input.profile.naturalLanguagePreference)}</p>
        <h2>户型分析</h2>
        <p>${escapeHtml(input.analysis.relationships.join("；"))}</p>
        <p>${escapeHtml(input.analysis.issues.map((issue) => issue.description).join("；"))}</p>
        <h2>整体策略</h2>
        <p>${escapeHtml(input.plan.overallStrategy)}</p>
        <p>${escapeHtml(input.plan.budgetAssumptions)}</p>
        ${spaces}
        <section>
          <h2>说明</h2>
          <p>${escapeHtml(input.plan.disclaimer)}</p>
        </section>
      </body>
    </html>
  `;
}

export async function renderBriefPdf(input: BriefPdfInput) {
  const browser = await chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();
    await page.setContent(buildBriefHtml(input), { waitUntil: "networkidle" });
    return await page.pdf({ format: "A4", printBackground: true });
  } finally {
    await browser.close();
  }
}
