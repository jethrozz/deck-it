import type { AiProvider, AgentTurnInput, AgentTurnOutput } from "@/lib/ai/ai-provider";
import {
  buildChatUrl,
  buildImageUrl,
  extractTextContent,
  parseJsonObject,
  postJson,
  type ChatCompletionResponse
} from "@/lib/ai/http";
import {
  agentInterviewResponseSchema,
  designPlanSchema,
  floorPlanAnalysisSchema
} from "@/lib/domain/schemas";
import type { FloorPlanAnalysis, PreferenceProfile } from "@/lib/domain/schemas";

type DoubaoConfig = {
  apiKey: string;
  baseUrl: string;
  chatModel: string;
  visionModel: string;
  imageModel: string;
  imageSize: string;
};

const roomTypeMap = new Map<string, string>([
  ["living_dining", "living_dining"],
  ["客餐厅", "living_dining"],
  ["客厅", "living_dining"],
  ["餐厅", "living_dining"],
  ["卧室", "master_bedroom"],
  ["主卧", "master_bedroom"],
  ["master_bedroom", "master_bedroom"],
  ["kitchen", "kitchen"],
  ["厨房", "kitchen"],
  ["child_room", "child_room"],
  ["儿童房", "child_room"],
  ["study", "study"],
  ["书房", "study"],
  ["bathroom", "bathroom"],
  ["卫生间", "bathroom"],
  ["balcony", "balcony"],
  ["阳台", "balcony"],
  ["交通空间", "other"],
  ["过道", "other"],
  ["other", "other"]
]);

const issueTypeMap = new Map<string, string>([
  ["lighting", "lighting"],
  ["采光", "lighting"],
  ["circulation", "circulation"],
  ["动线", "circulation"],
  ["storage", "storage"],
  ["收纳", "storage"],
  ["layout", "layout"],
  ["布局", "layout"],
  ["布局缺陷", "layout"],
  ["unclear", "unclear"],
  ["信息缺失", "unclear"],
  ["未知", "unclear"]
]);

function asString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object") {
    const candidateKeys = ["description", "text", "name", "label", "value", "reason"];
    for (const key of candidateKeys) {
      const candidate = (value as Record<string, unknown>)[key];
      if (typeof candidate === "string" && candidate.trim().length > 0) {
        return candidate.trim();
      }
    }
  }

  return undefined;
}

function asConfidence(value: unknown, fallback = 0.7): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }

  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return Math.min(1, Math.max(0, numeric));
    }
  }

  return fallback;
}

function normalizeRoomType(value: unknown): string {
  const label = asString(value);
  if (!label) {
    return "other";
  }

  return roomTypeMap.get(label) ?? "other";
}

function normalizeIssueType(value: unknown): string {
  const label = asString(value);
  if (!label) {
    return "unclear";
  }

  return issueTypeMap.get(label) ?? "unclear";
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values
    .map((item) => asString(item))
      .filter((item): item is string => Boolean(item && item.length > 0));
}

function buildFallbackRenderingPrompt(input: {
  title: string;
  type: string;
  designGoal: string;
  styleSummary?: string;
  explanation: string;
  layoutSuggestion: string;
  paletteAndMaterials: string[];
  furnitureAndSoftDecor: string[];
  practicalNotes: string[];
  budgetTradeOffs: string;
}): string {
  const typeSpecificNeeds: Record<string, string> = {
    living_dining: "强调客餐厅一体化、通透动线、家庭互动场景",
    master_bedroom: "强调休息舒适度、安静氛围、卧室收纳完整性",
    kitchen: "强调操作台面、收纳效率、清洁友好和烹饪动线",
    child_room: "强调成长型家具、学习区、玩耍区与收纳安全",
    study: "强调书桌、书柜、专注办公或阅读氛围",
    bathroom: "强调干湿分离、洗漱收纳、耐用易清洁材质",
    balcony: "强调洗烘、晾晒、家政操作区与采光",
    other: `强调${input.title}的实际使用任务和核心功能配置`
  };

  return [
    `${input.title}室内设计效果图`,
    input.styleSummary ?? "温暖克制的现代原木风",
    `空间目标：${input.designGoal}`,
    `功能重点：${typeSpecificNeeds[input.type] ?? typeSpecificNeeds.other}`,
    `布局要点：${input.layoutSuggestion}`,
    `空间说明：${input.explanation}`,
    `主要材质与色彩：${input.paletteAndMaterials.join("、")}`,
    `关键家具与设备：${input.furnitureAndSoftDecor.join("、")}`,
    `落地要求：${input.practicalNotes.join("、")}`,
    `预算取舍：${input.budgetTradeOffs}`,
    "画面要求：真实住宅室内摄影，广角但不过度夸张，自然采光，清晰展示主要功能区，不要空房间，不要重复其他空间构图"
  ].join("；");
}

function isWeakKeySpace(space: Record<string, unknown>) {
  const title = asString(space.title) ?? asString(space.name) ?? "";
  const type = normalizeRoomType(space.spaceType ?? space.type ?? title);
  const explanation = asString(space.explanation) ?? "";
  const layoutSuggestion = asString(space.layoutSuggestion) ?? "";
  const designGoal = asString(space.designGoal) ?? "";

  return (
    title === "重点空间" ||
    designGoal === "重点空间的功能优化与风格统一" ||
    explanation.includes("以提升使用体验为核心") ||
    layoutSuggestion.includes("优先保证通行、采光和主要功能布局") ||
    type === "other"
  );
}

function needsDesignPlanRetry(raw: unknown): boolean {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const keySpaces = Array.isArray(source.keySpaces) ? source.keySpaces : [];

  if (keySpaces.length === 0) {
    return true;
  }

  const normalizedTitles = keySpaces.map((space) => {
    const record = space && typeof space === "object" ? (space as Record<string, unknown>) : {};
    return asString(record.title) ?? asString(record.name) ?? "";
  });

  const uniqueTitles = new Set(normalizedTitles.filter(Boolean));
  const weakSpaceCount = keySpaces.filter((space) => {
    const record = space && typeof space === "object" ? (space as Record<string, unknown>) : {};
    return isWeakKeySpace(record);
  }).length;

  return uniqueTitles.size < keySpaces.length || weakSpaceCount >= Math.ceil(keySpaces.length / 2);
}

function isWeakNormalizedSpace(space: Record<string, unknown>): boolean {
  const title = asString(space.title) ?? "";
  const type = normalizeRoomType(space.spaceType ?? space.type ?? title);
  const designGoal = asString(space.designGoal) ?? "";
  const explanation = asString(space.explanation) ?? "";
  const layoutSuggestion = asString(space.layoutSuggestion) ?? "";
  const genericTitle = title === "重点空间" || title.length === 0;
  const genericCopy =
    designGoal === `${title}的功能优化与风格统一` ||
    explanation.includes("提升使用体验为核心") ||
    layoutSuggestion.includes("优先保证通行、采光和主要功能布局");

  return (
    genericTitle ||
    genericCopy ||
    (type === "other" && (genericTitle || genericCopy))
  );
}

function ensureStrongNormalizedPlan(raw: unknown): unknown {
  const normalized = normalizeDesignPlan(raw);
  const source = normalized && typeof normalized === "object" ? (normalized as Record<string, unknown>) : {};
  const keySpaces = Array.isArray(source.keySpaces) ? source.keySpaces : [];
  const weakCount = keySpaces.filter((space) => {
    const record = space && typeof space === "object" ? (space as Record<string, unknown>) : {};
    return isWeakNormalizedSpace(record);
  }).length;

  if (keySpaces.length === 0 || weakCount >= Math.ceil(keySpaces.length / 2)) {
    throw new Error("设计方案内容过于泛化，缺少可展示的重点空间描述。");
  }

  return normalized;
}

function summarizeNormalizedPlanQuality(raw: unknown) {
  const normalized = normalizeDesignPlan(raw);
  const source = normalized && typeof normalized === "object" ? (normalized as Record<string, unknown>) : {};
  const keySpaces = Array.isArray(source.keySpaces) ? source.keySpaces : [];
  const weakCount = keySpaces.filter((space) => {
    const record = space && typeof space === "object" ? (space as Record<string, unknown>) : {};
    return isWeakNormalizedSpace(record);
  }).length;

  return {
    normalized,
    keySpacesLength: keySpaces.length,
    weakCount,
    isStrong: keySpaces.length > 0 && weakCount < Math.ceil(keySpaces.length / 2)
  };
}

function hasKeyword(haystack: string, keywords: string[]) {
  return keywords.some((keyword) => haystack.includes(keyword));
}

function pickFirstRoom(analysis: FloorPlanAnalysis, types: string[]) {
  return analysis.rooms.find((room) => types.includes(room.type));
}

function buildDeterministicSpace(input: {
  title: string;
  type: string;
  designGoal: string;
  explanation: string;
  layoutSuggestion: string;
  paletteAndMaterials: string[];
  furnitureAndSoftDecor: string[];
  practicalNotes: string[];
  budgetTradeOffs: string;
  styleSummary: string;
}) {
  return {
    spaceType: input.type,
    title: input.title,
    designGoal: input.designGoal,
    explanation: input.explanation,
    layoutSuggestion: input.layoutSuggestion,
    paletteAndMaterials: input.paletteAndMaterials,
    furnitureAndSoftDecor: input.furnitureAndSoftDecor,
    budgetTradeOffs: input.budgetTradeOffs,
    practicalNotes: input.practicalNotes,
    renderingPrompt: buildFallbackRenderingPrompt({
      title: input.title,
      type: input.type,
      designGoal: input.designGoal,
      styleSummary: input.styleSummary,
      explanation: input.explanation,
      layoutSuggestion: input.layoutSuggestion,
      paletteAndMaterials: input.paletteAndMaterials,
      furnitureAndSoftDecor: input.furnitureAndSoftDecor,
      practicalNotes: input.practicalNotes,
      budgetTradeOffs: input.budgetTradeOffs
    })
  };
}

function buildDeterministicFallbackPlan(input: {
  analysis: FloorPlanAnalysis;
  profile: PreferenceProfile;
  conversationSummary: string;
}) {
  const combinedText = [
    input.profile.naturalLanguagePreference,
    input.conversationSummary,
    input.analysis.relationships.join("，"),
    input.analysis.issues.map((item) => item.description).join("，")
  ].join("，");
  const styleSummaryMap: Record<string, string> = {
    warm_wood: "温暖原木，强调自然材质、柔和采光和长期耐看。",
    vintage: "中古质感，强调木质纹理、复古灯光和居住温度。",
    modern_minimal: "现代简约，强调利落线条、通透感和清爽收纳。",
    bright: "明亮通透，强调浅色基底、自然采光和轻盈体量。",
    wabi_sabi: "侘寂克制，强调自然肌理、留白感和安静氛围。"
  };
  const styleSummary = styleSummaryMap[input.profile.style] ?? "现代原木，强调通透、耐看和舒适落地。";
  const spaces: Array<ReturnType<typeof buildDeterministicSpace>> = [];

  const livingDining = pickFirstRoom(input.analysis, ["living_dining"]);
  if (livingDining) {
    spaces.push(
      buildDeterministicSpace({
        title: "客餐厅",
        type: "living_dining",
        designGoal: "提升公共区通透感、收纳效率和家庭互动体验",
        explanation: "结合客餐厅与相邻阳台的关系，优先放大公共区的采光、动线和日常收纳能力，让家庭活动和会客都更舒展。",
        layoutSuggestion: "沙发与餐桌沿主要采光面组织，餐边柜和玄关柜尽量一体化延展，减少零碎突出的柜体对通行动线的影响。",
        paletteAndMaterials: ["浅木饰面", "暖白墙面", "低反光耐磨地面"],
        furnitureAndSoftDecor: ["低靠背沙发", "圆角餐桌", "餐边柜", "层次照明"],
        practicalNotes: ["保留客厅到阳台的视觉延伸", "优先补齐封闭收纳", "避免厚重隔断"],
        budgetTradeOffs: "预算优先投入在一体化柜体、灯光层次和高频接触面的耐用材质上。",
        styleSummary
      })
    );
  }

  if (hasKeyword(combinedText, ["书房", "客房", "多功能", "办公", "临时住", "墨菲"])) {
    spaces.push(
      buildDeterministicSpace({
        title: "多功能房",
        type: "other",
        designGoal: "兼顾书房办公、临时客房和整洁收纳",
        explanation: "这个空间优先承担办公阅读与临时留宿两种角色，因此需要在书桌、隐藏床位和整面收纳之间取得平衡，而不是做成单一卧室。",
        layoutSuggestion: "靠墙布置书桌与高柜，预留可展开的临时床位，优先保证展开床位后的通行与窗边采光。",
        paletteAndMaterials: ["浅木柜体", "暖白墙面", "耐磨地板"],
        furnitureAndSoftDecor: ["书桌", "墨菲床或沙发床", "顶天立地收纳柜", "阅读灯"],
        practicalNotes: ["平时保持书房整洁感", "保留临时留宿功能", "加强文件和杂物分类收纳"],
        budgetTradeOffs: "预算优先投入在隐藏床结构、定制收纳和耐用五金上。",
        styleSummary
      })
    );
  }

  if (hasKeyword(combinedText, ["孩子", "儿童", "学习", "玩耍", "绘本"])) {
    spaces.push(
      buildDeterministicSpace({
        title: "儿童房",
        type: "child_room",
        designGoal: "兼顾睡眠、玩耍与未来学习升级",
        explanation: "儿童房需要从当前的玩耍陪伴场景出发，同时预留后续学习桌、绘本与玩具收纳的位置，避免很快被二次改造。",
        layoutSuggestion: "床位沿安静侧布置，窗边预留成长书桌位置，矮柜承担绘本和玩具收纳，中间尽量留出活动面。",
        paletteAndMaterials: ["暖白墙面", "浅木家具", "柔和织物"],
        furnitureAndSoftDecor: ["儿童床", "成长书桌", "矮柜", "开放格书架"],
        practicalNotes: ["保留活动区", "预留学习位升级", "控制尖角与磕碰风险"],
        budgetTradeOffs: "预算优先给成长型家具和顺手的收纳系统。",
        styleSummary
      })
    );
  }

  if (hasKeyword(combinedText, ["阳台", "洗烘", "家政", "公卫", "卫生间", "干湿分离"])) {
    spaces.push(
      buildDeterministicSpace({
        title: hasKeyword(combinedText, ["公卫", "卫生间"]) ? "阳台家政区+公卫" : "阳台家政区",
        type: "other",
        designGoal: "兼顾洗烘、家政收纳与相邻卫浴的高频使用效率",
        explanation: "阳台和卫浴相关空间承担洗烘、清洁与日常整理任务，重点不是装饰感，而是把设备位、杂物收纳和清爽动线组织清楚。",
        layoutSuggestion: "洗衣机与烘干机尽量叠放或并排靠边布置，侧边配置家政高柜；若连着公卫，优先强化干湿分离和镜柜收纳。",
        paletteAndMaterials: ["防滑地砖", "浅灰柜体", "耐水饰面"],
        furnitureAndSoftDecor: ["洗衣机", "烘干机", "家政高柜", "镜柜或壁龛"],
        practicalNotes: ["优先保证洗烘区顺手", "补足清洁用品收纳", "如涉及卫浴则强调干湿分离"],
        budgetTradeOffs: "预算优先投入在设备位尺寸、耐水柜体和卫浴收纳上。",
        styleSummary
      })
    );
  }

  for (const fallbackRoom of input.analysis.rooms) {
    if (spaces.length >= 3) {
      break;
    }

    const alreadyCovered =
      (fallbackRoom.type === "living_dining" && spaces.some((space) => space.spaceType === "living_dining")) ||
      (fallbackRoom.type === "child_room" && spaces.some((space) => space.spaceType === "child_room")) ||
      (fallbackRoom.type === "master_bedroom" && spaces.some((space) => space.title === "主卧"));

    if (alreadyCovered) {
      continue;
    }

    if (fallbackRoom.type === "master_bedroom") {
      spaces.push(
        buildDeterministicSpace({
          title: "主卧",
          type: "master_bedroom",
          designGoal: "营造安静、好打理且有充足收纳的休息空间",
          explanation: "主卧以休息质量和长期耐看为先，尽量减少复杂背景和低效展示，把储物与舒适度做扎实。",
          layoutSuggestion: "床头背景保持克制，衣柜尽量整面化，预留床两侧顺手通行与基础照明。",
          paletteAndMaterials: ["米灰软装", "浅木饰面", "柔和织物"],
          furnitureAndSoftDecor: ["软包床", "衣柜", "床头灯", "遮光窗帘"],
          practicalNotes: ["保证床侧通行", "控制灯光眩光", "优先封闭收纳"],
          budgetTradeOffs: "预算优先放在环保板材、床垫和衣柜五金上。",
          styleSummary
        })
      );
    } else if (fallbackRoom.type === "kitchen") {
      spaces.push(
        buildDeterministicSpace({
          title: "厨房",
          type: "kitchen",
          designGoal: "提升烹饪动线、台面效率和清洁便利性",
          explanation: "厨房作为高频使用区，更需要把台面、吊柜地柜和家电位安排清楚，减少堆叠和回头路。",
          layoutSuggestion: "优先保证洗切炒顺序，常用小电器集中到固定台面区域，尽量增加封闭收纳。",
          paletteAndMaterials: ["浅色柜门", "石英台面", "防污墙面"],
          furnitureAndSoftDecor: ["地柜", "吊柜", "抽屉拉篮", "嵌入式家电位"],
          practicalNotes: ["增强备餐台面", "减少杂物外露", "优先易清洁材质"],
          budgetTradeOffs: "预算优先投入在台面、铰链和抽屉五金等高频部位。",
          styleSummary
        })
      );
    }
  }

  const keySpaces = spaces.slice(0, 3);

  return {
    overallStrategy: "围绕户型本身的采光、动线和高频生活需求，优先把公共区通透感、关键收纳和复合功能空间梳理清楚，再统一整体风格语汇。",
    styleSummary,
    budgetAssumptions:
      input.profile.budgetTier === "economy"
        ? "经济型预算下，优先把预算放在高频柜体、基础灯光和耐用表面材料。"
        : input.profile.budgetTier === "premium"
          ? "高品质预算下，可以兼顾柜体细节、灯光层次、质感面材和更完整的设备配置。"
          : "品质型预算下，优先平衡一体化收纳、灯光氛围和核心空间的耐用落地。 ",
    keySpaces,
    disclaimer: "本方案为装修前沟通 brief，适合前期方向讨论，不等同于施工图或正式报价。"
  };
}

function normalizeFloorPlanAnalysis(raw: unknown): unknown {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};

  const rooms = Array.isArray(source.rooms)
    ? source.rooms.map((item) => {
        const room = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          name: asString(room.name) ?? asString(room.label) ?? "未命名空间",
          type: normalizeRoomType(room.type ?? room.category ?? room.name),
          confidence: asConfidence(room.confidence)
        };
      })
    : [];

  const issues = Array.isArray(source.issues)
    ? source.issues.map((item) => {
        const issue = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        return {
          type: normalizeIssueType(issue.type ?? issue.category ?? issue.name),
          description: asString(issue.description) ?? asString(issue.name) ?? "未说明问题",
          confidence: asConfidence(issue.confidence)
        };
      })
    : [];

  return {
    rooms,
    relationships: normalizeStringArray(source.relationships),
    issues,
    uncertainItems: normalizeStringArray(source.uncertainItems),
    userCorrections: normalizeStringArray(source.userCorrections)
  };
}

function normalizeDesignPlan(raw: unknown): unknown {
  const source = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const keySpaces = Array.isArray(source.keySpaces)
    ? source.keySpaces.map((item) => {
        const space = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const designPoints = normalizeStringArray(space.designPoints);
        const title = asString(space.title) ?? asString(space.name) ?? "重点空间";
        const type = normalizeRoomType(space.spaceType ?? space.type ?? space.title ?? space.name);
        const designGoal =
          asString(space.designGoal) ??
          designPoints[0] ??
          `${title}的功能优化与风格统一`;
        const explanation =
          asString(space.explanation) ??
          `${title}以${designPoints.slice(0, 2).join("，") || "提升使用体验"}为核心，结合当前户型信息做原木风方向设计。`;
        const layoutSuggestion =
          asString(space.layoutSuggestion) ??
          designPoints[0] ??
          `${title}优先保证通行、采光和主要功能布局。`;
        const paletteAndMaterials = normalizeStringArray(space.paletteAndMaterials);
        const furnitureAndSoftDecor = normalizeStringArray(space.furnitureAndSoftDecor);
        const practicalNotes = normalizeStringArray(space.practicalNotes);
        const fallbackPaletteAndMaterials = [
          `${title}以浅木色、耐用饰面和柔和基础色保持整体温暖感。`
        ];
        const fallbackFurnitureAndSoftDecor = [
          `${title}优先选择线条简洁、体量克制的家具，并用基础软装维持舒适度。`
        ];
        const budgetTradeOffs =
          asString(space.budgetTradeOffs) ??
          `优先把预算投入在${title}的高频使用面、基础收纳和耐用材质上。`;
        const normalizedPaletteAndMaterials =
          paletteAndMaterials.length > 0
            ? paletteAndMaterials
            : designPoints.length > 0
              ? designPoints.slice(0, 3)
              : fallbackPaletteAndMaterials;
        const normalizedFurnitureAndSoftDecor =
          furnitureAndSoftDecor.length > 0
            ? furnitureAndSoftDecor
            : designPoints.length > 0
              ? designPoints.slice(0, 3)
              : fallbackFurnitureAndSoftDecor;
        const normalizedPracticalNotes = practicalNotes.length > 0 ? practicalNotes : designPoints;
        const renderingPrompt =
          asString(space.renderingPrompt) ??
          buildFallbackRenderingPrompt({
            title,
            type,
            designGoal,
            styleSummary: asString(source.styleSummary),
            explanation,
            layoutSuggestion,
            paletteAndMaterials: normalizedPaletteAndMaterials,
            furnitureAndSoftDecor: normalizedFurnitureAndSoftDecor,
            practicalNotes: normalizedPracticalNotes,
            budgetTradeOffs
          });

        return {
          ...space,
          spaceType: type,
          title,
          designGoal,
          explanation,
          layoutSuggestion,
          paletteAndMaterials: normalizedPaletteAndMaterials,
          furnitureAndSoftDecor: normalizedFurnitureAndSoftDecor,
          budgetTradeOffs,
          practicalNotes: normalizedPracticalNotes,
          renderingPrompt
        };
      })
    : [];

  return {
    ...source,
    keySpaces
  };
}

export class DoubaoProvider implements AiProvider {
  constructor(private readonly config: DoubaoConfig) {}

  private async chatJson(input: {
    model: string;
    systemPrompt: string;
    userPayload: unknown;
    logLabel?: string;
  }): Promise<unknown> {
    const response = await postJson<ChatCompletionResponse>(
      buildChatUrl(this.config.baseUrl),
      this.config.apiKey,
      {
        model: input.model,
        temperature: 0.2,
        messages: [
          { role: "system", content: input.systemPrompt },
          {
            role: "user",
            content: `请严格输出 JSON，不要输出额外说明。\n${JSON.stringify(input.userPayload)}`
          }
        ]
      }
    );

    const rawText = extractTextContent(response);
    if (input.logLabel) {
      console.info(`[DoubaoProvider] ${input.logLabel} raw response:\n${rawText}`);
    }

    return parseJsonObject(rawText);
  }

  async analyzeFloorPlan(input: { imageUrl: string; imageDataUrl?: string }) {
    const imageReference = input.imageDataUrl ?? input.imageUrl;
    const response = await postJson<ChatCompletionResponse>(
      buildChatUrl(this.config.baseUrl),
      this.config.apiKey,
      {
        model: this.config.visionModel,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              [
                "你是专业室内设计师助手，正在直接查看一张住宅户型图本身，而不是网页截图、上传界面或文件列表。",
                "你的任务是尽最大可能从图片中识别户型空间、空间关系和潜在问题。",
                "即使图片信息不完整，也必须先做尽可能合理的识别，再把不确定点放进 uncertainItems。",
                "禁止输出“只上传了文件”“未执行分析”“没有进行识别操作”“无法确认所有信息”这类把任务本身误解成系统流程说明的话。",
                "返回严格 JSON，字段必须是 rooms, relationships, issues, uncertainItems, userCorrections。",
                "rooms 里每项包含 name,type,confidence；type 只能是 living_dining, master_bedroom, kitchen, child_room, study, bathroom, balcony, other。",
                "issues 里每项包含 type,description,confidence；type 只能是 lighting, circulation, storage, layout, unclear。",
                "如果无法分辨房间功能，可以先用 other，并在 uncertainItems 里写清楚原因。",
                "不要输出施工图结论、尺寸复核结论或精确报价。"
              ].join(" ")
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: [
                  "下面这张图片就是待分析的住宅户型图本身。",
                  "请直接阅读图片里的空间轮廓、文字标注、门窗关系和阳台/卫浴/厨房等典型位置，输出 JSON。",
                  "请优先识别：客餐厅、主卧、次卧/儿童房、书房、厨房、卫生间、阳台、过道等。",
                  "relationships 请写空间连接关系，例如“客餐厅连接阳台”“厨房靠近餐厅”“主卧位于安静一侧”。",
                  "issues 请写户型层面的潜在问题，例如采光、动线、收纳、布局冲突。",
                  "如果有不确定的区域，请只把不确定项放进 uncertainItems，不要把整张图都判成未分析。",
                  "请严格输出 JSON，不要加解释文字。"
                ].join(" ")
              },
              {
                type: "image_url",
                image_url: {
                  url: imageReference
                }
              }
            ]
          }
        ]
      }
    );

    return floorPlanAnalysisSchema.parse(
      normalizeFloorPlanAnalysis(parseJsonObject(extractTextContent(response)))
    );
  }

  async nextAgentTurn(input: AgentTurnInput): Promise<AgentTurnOutput> {
    const raw = await this.chatJson({
      model: this.config.chatModel,
      systemPrompt:
        [
          "你是装修设计师 Agent。",
          "最多追问 12 个问题，但正常应尽量在 4-6 轮内完成需求澄清。",
          "请先提出设计想法或需求探索问题，再根据用户回答继续推进。",
          "当你已经明确了公共区方向、关键卧室功能、阳台/卫浴等硬约束、以及用户最在意的生活需求后，应优先输出 complete，不要继续追问琐碎偏好。",
          "避免为了凑轮数继续追问；没有明显决策价值的问题不要再问。",
          "格式必须是 JSON，type 只能是 designer_prompt、suggestion 或 complete。"
        ].join(" "),
      userPayload: {
        schema: {
          designer_prompt: {
            type: "designer_prompt",
            message: "string",
            options: ["string", "string"],
            recommendation: "string (optional)",
            progress: {
              current: 1,
              max: 12
            }
          },
          suggestion: {
            type: "suggestion",
            message: "string",
            options: ["采纳", "不采纳", "再解释一下"],
            progress: {
              current: 1,
              max: 12
            }
          },
          complete: {
            type: "complete",
            summary: "string",
            nextPath: "/generating"
          }
        },
        analysis: input.analysis,
        profile: input.profile,
        conversation: input.conversation
      }
    });

    const normalized = agentInterviewResponseSchema.safeParse(raw);
    if (normalized.success) {
      return normalized.data;
    }

    const parsed = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
    if (parsed.type === "complete") {
      return {
        type: "complete",
        summary: asString(parsed.summary) ?? "已收集足够信息，将按当前需求生成装修设计方案。",
        nextPath: "/generating"
      };
    }

    const normalizedOptions = normalizeStringArray(parsed.options);
    const currentTurn = Math.min(Math.max(input.conversation.filter((message) => message.role === "agent").length + 1, 1), 12);

    return {
      type: parsed.type === "suggestion" ? "suggestion" : "designer_prompt",
      message:
        asString(parsed.message) ??
        "我已经看过户型和偏好。你们最希望优先改善哪个空间，客餐厅、主卧，还是次卧/书房？",
      options:
        normalizedOptions.length > 0
          ? normalizedOptions
          : parsed.type === "suggestion"
            ? ["采纳", "不采纳", "再解释一下"]
            : ["客餐厅", "主卧", "次卧/书房"],
      recommendation: asString(parsed.recommendation),
      progress: {
        current: currentTurn,
        max: 12
      }
    };
  }

  async generateDesignPlan(input: Parameters<AiProvider["generateDesignPlan"]>[0]) {
    const buildPrompt = (retry = false) =>
      [
        "你是专业住宅室内设计师，正在为装修前沟通阶段生成一份可展示、可落地的设计 brief。",
        "你必须严格返回 JSON 对象，不要输出任何额外说明、前后缀、markdown 或代码块。",
        "返回字段必须且只能包含：overallStrategy, styleSummary, budgetAssumptions, keySpaces, disclaimer。",
        "overallStrategy：1 段总策略，说明这套方案如何回应户型问题、生活方式和重点改造方向。",
        "styleSummary：1 段风格总结，说明气质、材质和空间氛围。",
        "budgetAssumptions：1 段预算取舍，说明预算优先投放在哪些高频区域或材料。",
        "disclaimer：1 段边界说明，明确这是前期沟通 brief，不是施工图或正式报价。",
        "keySpaces：长度必须是 2 到 3 的数组，每一项都必须是一个具体房间或具体复合功能区，禁止使用“重点空间”“其他空间”这类泛化标题。",
        "每个 keySpace 必须包含且只能包含：spaceType, title, designGoal, explanation, layoutSuggestion, paletteAndMaterials, furnitureAndSoftDecor, budgetTradeOffs, practicalNotes, renderingPrompt。",
        "spaceType 只能是：living_dining, master_bedroom, kitchen, child_room, study, bathroom, balcony, other。",
        "title 必须是可展示的具体空间名，例如“客餐厅”“多功能房”“儿童房”“阳台家政区+公卫”。",
        "designGoal：一句明确说明这个空间要解决什么问题，不要写空话。",
        "explanation：1 段解释这个空间为什么这样设计，要结合户型关系、使用人群或生活场景。",
        "layoutSuggestion：1 段布局建议，必须写家具/设备/收纳/动线如何组织。",
        "paletteAndMaterials：2 到 4 个字符串，写具体材质和色彩，不要空数组。",
        "furnitureAndSoftDecor：3 到 6 个字符串，写关键家具、设备或软装，不要空数组。",
        "budgetTradeOffs：1 段预算取舍，明确这个空间优先花钱的点。",
        "practicalNotes：2 到 4 个字符串，写施工前沟通阶段最值得确认的落地点。",
        "renderingPrompt：一整段可直接用于室内效果图生成的中文 prompt，必须写清空间用途、用户需求、关键家具设备、材质、采光、视角，并且不同空间的 renderingPrompt 必须明显不同。",
        "如果是多功能房、儿童房、阳台家政区、卫浴等功能明确的空间，renderingPrompt 里必须出现对应设施或场景，例如书桌、墨菲床、玩耍区、洗烘区、干湿分离等。",
        "不要返回空字段，不要返回空数组，不要偷懒用模板句。",
        retry
          ? "这次是纠偏重试：上一版方案过于泛化。禁止出现“重点空间”“其他空间优化”“功能优化与风格统一”“提升使用体验为核心”这类模板词。请输出具体房间名、具体功能和具体布局。"
          : ""
      ]
        .filter(Boolean)
        .join(" ");

    const buildUserPayload = (retry = false, previousAttempt?: unknown, retryReason?: string) => ({
      task: "根据户型分析、偏好和访谈总结，生成一份用于前期沟通的装修设计 brief。",
      outputRequirements: {
        format: "strict_json_object",
        topLevelFields: [
          "overallStrategy",
          "styleSummary",
          "budgetAssumptions",
          "keySpaces",
          "disclaimer"
        ],
        keySpacesLength: "2-3"
      },
      schema: {
        overallStrategy: "string",
        styleSummary: "string",
        budgetAssumptions: "string",
        disclaimer: "string",
        keySpaces: [
          {
            spaceType:
              "living_dining | master_bedroom | kitchen | child_room | study | bathroom | balcony | other",
            title: "string",
            designGoal: "string",
            explanation: "string",
            layoutSuggestion: "string",
            paletteAndMaterials: ["string", "string"],
            furnitureAndSoftDecor: ["string", "string", "string"],
            budgetTradeOffs: "string",
            practicalNotes: ["string", "string"],
            renderingPrompt: "string"
          }
        ]
      },
      fieldGuidance: {
        title: "必须是具体房间或复合功能区名称，禁止使用泛化标题",
        layoutSuggestion: "必须写布局、家具、设备或收纳组织方式",
        renderingPrompt: "必须可直接用于室内效果图生成，并体现空间用途、用户需求、关键家具设备、材质、采光和视角"
      },
      analysis: input.analysis,
      profile: input.profile,
      conversationSummary: input.conversationSummary,
      ...(retry ? { previousAttempt, retryReason } : {})
    });

    const firstRaw = await this.chatJson({
      model: this.config.chatModel,
      systemPrompt: buildPrompt(false),
      userPayload: buildUserPayload(false),
      logLabel: "design-plan attempt-1"
    });

    const resolvedRaw = needsDesignPlanRetry(firstRaw)
      ? await this.chatJson({
          model: this.config.chatModel,
          systemPrompt: buildPrompt(true),
          userPayload: buildUserPayload(
            true,
            firstRaw,
            "上一次重点空间过于泛化，缺少具体房间角色与功能区描述。请重新输出更具体的重点空间方案。"
          ),
          logLabel: "design-plan attempt-2"
        })
      : firstRaw;

    try {
      return designPlanSchema.parse(ensureStrongNormalizedPlan(resolvedRaw));
    } catch (error) {
      const secondRetryRaw = await this.chatJson({
        model: this.config.chatModel,
        systemPrompt: buildPrompt(true),
        userPayload: buildUserPayload(
          true,
          resolvedRaw,
          error instanceof Error
            ? `${error.message}。请输出具体空间名称、具体功能区和具体布局说明，不要留空字段。`
            : "上一版方案字段不完整，请输出更具体的重点空间方案。"
        ),
        logLabel: "design-plan attempt-3"
      });
      const finalQuality = summarizeNormalizedPlanQuality(secondRetryRaw);
      if (!finalQuality.isStrong) {
        console.warn(
          `[DoubaoProvider] design-plan final output still weak after retries: keySpaces=${finalQuality.keySpacesLength}, weakCount=${finalQuality.weakCount}`
        );
      }

      return designPlanSchema.parse(finalQuality.normalized);
    }
  }

  async generateRendering(input: { prompt: string; spaceTitle: string }) {
    const result = await postJson<{ data?: Array<{ url?: string; b64_json?: string }> }>(
      buildImageUrl(this.config.baseUrl),
      this.config.apiKey,
      {
        model: this.config.imageModel,
        prompt: input.prompt,
        size: this.config.imageSize,
        response_format: "url"
      }
    );

    const url = result.data?.[0]?.url;
    if (!url) {
      throw new Error(`Seedream did not return image URL for ${input.spaceTitle}`);
    }

    return { imageUrl: url };
  }
}
