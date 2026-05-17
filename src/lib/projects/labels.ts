import type { BudgetTier, RoomType, Style } from "@/lib/domain/schemas";

export const styleLabels = {
  warm_wood: "原木风",
  vintage: "中古风",
  modern_minimal: "现代简约",
  bright: "明亮通透",
  wabi_sabi: "侘寂风"
} as const satisfies Record<Style, string>;

export const budgetLabels = {
  economy: { title: "经济型", range: "10-15 万" },
  quality: { title: "品质型", range: "15-25 万" },
  premium: { title: "高品质型", range: "25 万以上" }
} as const satisfies Record<BudgetTier, { title: string; range: string }>;

export const roomLabels = {
  living_dining: "客餐厅",
  master_bedroom: "主卧",
  kitchen: "厨房",
  child_room: "儿童房",
  study: "书房",
  bathroom: "卫生间",
  balcony: "阳台",
  other: "其他空间"
} as const satisfies Record<RoomType, string>;
