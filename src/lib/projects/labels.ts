import type { BudgetTier, RoomType, Style } from "@/lib/domain/schemas";

type StyleLabelKey = Style | "bright";

export const styleLabels: Record<StyleLabelKey, string> = {
  warm_wood: "原木风",
  vintage: "中古风",
  modern_minimal: "现代简约",
  bright: "明亮通透",
  wabi_sabi: "侘寂风"
};

export const budgetLabels: Record<BudgetTier, { title: string; range: string }> = {
  economy: { title: "经济型", range: "10-15 万" },
  quality: { title: "品质型", range: "15-25 万" },
  premium: { title: "高品质型", range: "25 万以上" }
};

export const roomLabels: Record<RoomType, string> = {
  living_dining: "客餐厅",
  master_bedroom: "主卧",
  kitchen: "厨房",
  child_room: "儿童房",
  study: "书房",
  bathroom: "卫生间",
  balcony: "阳台",
  other: "其他空间"
};
