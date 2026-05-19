# 多模型能力拆分设计规格

## 1. 背景

当前项目的 AI 适配层只支持一套 `doubao` provider。户型图分析、设计师追问、方案文案生成和效果图生成都默认绑定在同一套厂商配置上。

现在需要把能力拆分为三段独立路由：

- 户型图分析使用千问视觉模型。
- 文本对话与方案文案生成使用 DeepSeek V4。
- 图片生成继续使用豆包 Seedream。

本次设计的目标不是改业务流程，而是把模型供应商选择从业务逻辑中抽离出来，让三段能力可通过环境变量独立配置。

## 2. 目标

- 保持现有业务层 `AiProvider` 接口不变。
- 将视觉、文本、图片三类能力分别路由到独立客户端。
- 允许未来只改环境变量就替换某一段能力的供应商或模型名。
- 尽量把改动限制在 `src/lib/ai/*` 和相关测试、文档中。

## 3. 非目标

- 不改产品路由、页面流程或数据库结构。
- 不新增新的生成阶段或新的用户输入字段。
- 不在本次改动中迁移图片生成供应商，图片生成仍使用豆包。
- 不在本次改动中引入供应商自动降级、负载均衡或多模型投票。

## 4. 供应商分工

### 4.1 视觉分析

- 供应商：千问
- 责任范围：`analyzeFloorPlan`
- 推荐默认模型：`qwen3-vl-plus`
- 接口依据：阿里云视觉理解文档支持图像输入、多模态消息和高分辨率图片处理。

### 4.2 文本对话与方案文案

- 供应商：DeepSeek
- 责任范围：`nextAgentTurn`、`generateDesignPlan`
- 推荐默认模型：`deepseek-v4-pro`
- 接口依据：DeepSeek 官方 `POST /chat/completions`，模型标识为 `deepseek-v4-pro` 或 `deepseek-v4-flash`。

### 4.3 图片生成

- 供应商：豆包
- 责任范围：`generateRendering`
- 保持现有 Seedream 调用方式不变

## 5. 设计方案

### 5.1 总体结构

保留现有 `AiProvider` 接口：

- `analyzeFloorPlan`
- `nextAgentTurn`
- `generateDesignPlan`
- `generateRendering`

新增一个组合实现 `CompositeAiProvider`。它不直接完成模型调用，而是把四个方法分别委派给三个能力客户端：

- `QwenVisionClient`
- `DeepSeekTextClient`
- `DoubaoImageClient`

业务层仍只依赖 `AiProvider`，不感知具体供应商。

### 5.2 文件结构

建议调整为：

- 新增 `src/lib/ai/composite-ai-provider.ts`
- 新增 `src/lib/ai/qwen-vision-client.ts`
- 新增 `src/lib/ai/deepseek-text-client.ts`
- 新增 `src/lib/ai/doubao-image-client.ts`
- 视实现情况保留或删除 `src/lib/ai/doubao-provider.ts`
- 更新 `src/lib/ai/provider-factory.ts`

如果保留旧文件，则其职责必须收缩，避免继续承担跨能力逻辑。

### 5.3 配置模型

环境变量按能力维度拆分，而不是按厂商维度绑定：

- `VISION_PROVIDER`
- `VISION_BASE_URL`
- `VISION_API_KEY`
- `VISION_MODEL`

- `TEXT_PROVIDER`
- `TEXT_BASE_URL`
- `TEXT_API_KEY`
- `TEXT_MODEL`

- `IMAGE_PROVIDER`
- `IMAGE_BASE_URL`
- `IMAGE_API_KEY`
- `IMAGE_MODEL`
- `IMAGE_SIZE`

推荐默认值：

- `VISION_PROVIDER=qwen`
- `TEXT_PROVIDER=deepseek`
- `IMAGE_PROVIDER=doubao`

为降低迁移成本，允许短期兼容旧变量回退：

- `IMAGE_API_KEY` 可回退到 `DOUBAO_API_KEY` 或 `ARK_API_KEY`
- `IMAGE_MODEL` 可回退到 `SEEDREAM_MODEL`
- `IMAGE_BASE_URL` 可回退到现有 Ark 默认值

本次不要求兼容旧的 `DOUBAO_VISION_MODEL` 或 `DOUBAO_CHAT_MODEL`，因为视觉和文本已明确迁出豆包路线。

## 6. 数据流

### 6.1 户型图分析

`POST /floor-plan` 上传图片后，业务层继续调用 `aiProvider.analyzeFloorPlan(...)`。

`CompositeAiProvider` 将该请求转发给 `QwenVisionClient`。视觉 client 继续接受现有的 `imageUrl` 和 `imageDataUrl` 参数，并优先复用当前 Base64 data URL 传图方式，避免为了切模型而重写上传链路。

### 6.2 设计师追问

业务层调用 `aiProvider.nextAgentTurn(...)` 时，由 `CompositeAiProvider` 转发给 `DeepSeekTextClient`。

DeepSeek 文本 client 负责组装多轮 `messages`，继续采用“系统提示 + 用户 JSON 载荷”的模式，并要求输出结构化 JSON。

### 6.3 方案文案生成

业务层调用 `aiProvider.generateDesignPlan(...)` 时，由 `CompositeAiProvider` 转发给 `DeepSeekTextClient`。

设计方案生成继续沿用现有 prompt 策略、重试策略和 schema 校验，只把模型调用实现从豆包改为 DeepSeek。

### 6.4 效果图生成

业务层调用 `aiProvider.generateRendering(...)` 时，由 `CompositeAiProvider` 转发给 `DoubaoImageClient`。

该链路沿用现有 `POST /images/generations`、Seedream 模型名和图片尺寸参数。

## 7. 供应商适配细节

### 7.1 千问视觉适配

千问视觉 client 负责：

- 发送多模态消息。
- 传入图片内容。
- 维持现有户型分析 system prompt 与 user prompt 语义。
- 清洗返回内容中的代码块或额外文本。
- 将结果归一化后交给 `floorPlanAnalysisSchema`。

实现上应优先使用当前项目已有的“提取文本 -> 去代码块 -> 解析 JSON”链路，避免为新供应商引入另一套解析风格。

### 7.2 DeepSeek 文本适配

DeepSeek 文本 client 负责：

- 统一 `POST /chat/completions` 调用。
- 封装 `nextAgentTurn` 与 `generateDesignPlan` 两个文本场景。
- 保持当前 JSON 输出约束与容错逻辑。
- 继续支持多轮对话场景下由调用方显式传递上下文。

DeepSeek 是无状态对话接口，因此 client 必须继续在每次请求中传入完整对话历史或完整结构化上下文。

### 7.3 豆包图片适配

豆包图片 client 只负责：

- 调用图片生成接口。
- 提取返回图片 URL。
- 在缺失 URL 时抛出明确错误。

它不再承担视觉分析或文本生成逻辑。

## 8. 错误处理

### 8.1 配置错误

工厂层按能力检查配置，报错应精确到能力：

- 缺少视觉配置时报视觉配置错误。
- 缺少文本配置时报文本配置错误。
- 缺少图片配置时报图片配置错误。

不要再使用单一 “Doubao provider requires ...” 这类聚合错误文案。

### 8.2 输出校验

三条链路都应在各自 client 内完成供应商输出清洗：

- 户型分析结果进入 `floorPlanAnalysisSchema`
- 追问结果进入 `agentInterviewResponseSchema`
- 设计方案结果进入 `designPlanSchema`

如果供应商输出不稳定，先在对应 client 内做归一化，再交给 schema 解析。业务层不接收供应商原始脏格式。

### 8.3 回退策略

本次仅保留现有文本结果的结构化兜底策略，不设计跨供应商自动回退。

如果某段能力配置正确但请求失败，直接返回明确错误，由现有调用链决定如何展示失败或重试。

## 9. 测试策略

### 9.1 单元测试

新增或调整以下测试重点：

- `provider-factory` 是否按环境变量装配组合 provider
- `QwenVisionClient` 是否正确发送图片与 prompt
- `DeepSeekTextClient` 是否正确发送多轮消息与 JSON 约束
- `DoubaoImageClient` 是否保持当前图片生成解析行为
- `CompositeAiProvider` 是否把四个接口正确分发到三个 client

### 9.2 回归风险

重点回归以下场景：

- 上传户型图后分析结果仍能正常入库
- 设计师追问仍能维持多轮进度和选项输出
- 设计方案生成仍能通过现有 schema 和重试逻辑
- 效果图 URL 仍能回写到项目渲染结果中

## 10. 实施顺序

推荐实现顺序：

1. 提取通用 HTTP / JSON 解析辅助逻辑
2. 新建三个能力 client
3. 新建 `CompositeAiProvider`
4. 改写 `provider-factory` 读取新环境变量
5. 更新 README 和 `.env` 说明
6. 补齐单元测试

这样可以先稳定适配层，再让上层继续复用原有工作流。

## 11. 风险与取舍

- 千问视觉和 DeepSeek 文本虽然都兼容聊天补全风格接口，但消息格式细节并不完全相同，适配层必须各自封装，不能继续假设“一个 JSON body 走遍所有供应商”。
- 旧类名 `DoubaoProvider` 已不再准确，继续沿用会误导后续维护者，因此建议本次一并更名或拆分。
- 若未来还会继续切换单段能力，能力维度配置比厂商维度配置更稳定，也更接近真实业务需求。

## 12. 验收标准

- 项目能通过环境变量分别指定视觉、文本、图片三段能力。
- 户型图分析调用千问视觉模型。
- 设计师追问与设计方案文案调用 DeepSeek V4。
- 图片生成继续调用豆包 Seedream。
- 业务层 `AiProvider` 接口与现有路由调用方式不变。
- README 中能清楚说明新的配置方式与迁移方式。
