import type { ProjectStatus } from "@prisma/client";

export type WizardStepKey =
  | "upload"
  | "analysis"
  | "preferences"
  | "interview"
  | "generating"
  | "complete";

export type WizardStep = {
  key: WizardStepKey;
  label: string;
  path: string;
};

export type TransitionMode = "auto" | "confirm";

export type StageTransitionConfig = {
  from: WizardStepKey;
  to: WizardStepKey;
  mode: TransitionMode;
  title?: string;
  description?: string;
  cta?: string;
  cancel?: string;
};

export const wizardSteps = [
  { key: "upload", label: "上传户型图", path: "upload" },
  { key: "analysis", label: "户型分析", path: "analysis" },
  { key: "preferences", label: "风格预算", path: "preferences" },
  { key: "interview", label: "设计师咨询", path: "interview" },
  { key: "generating", label: "生成中", path: "generating" },
  { key: "complete", label: "方案完成", path: "complete" }
] as const satisfies readonly WizardStep[];

const wizardStepByKey = new Map<WizardStepKey, WizardStep>(wizardSteps.map((step) => [step.key, step]));
const transitionConfigByKey = new Map<string, StageTransitionConfig>([
  ["analysis:preferences", { from: "analysis", to: "preferences", mode: "auto" }],
  ["preferences:interview", { from: "preferences", to: "interview", mode: "auto" }],
  [
    "interview:generating",
    {
      from: "interview",
      to: "generating",
      mode: "confirm",
      title: "确认开始生成方案？",
      description: "系统将基于户型分析与访谈结果开始生成完整方案。",
      cta: "开始生成",
      cancel: "稍后再说"
    }
  ],
  ["generating:complete", { from: "generating", to: "complete", mode: "auto" }]
]);

const statusToStep: Record<ProjectStatus, WizardStepKey> = {
  CREATED: "upload",
  FLOOR_PLAN_UPLOADING: "upload",
  FLOOR_PLAN_ANALYZING: "analysis",
  FLOOR_PLAN_ANALYZED: "analysis",
  ANALYSIS_CONFIRMED: "preferences",
  PREFERENCES_COLLECTED: "interview",
  INTERVIEWING: "interview",
  INTERVIEW_COMPLETE: "generating",
  AWAITING_PAYMENT: "generating",
  PAYMENT_PROCESSING: "generating",
  PAYMENT_SUCCEEDED: "generating",
  GENERATING_REQUIREMENT_PROFILE: "generating",
  GENERATING_PLAN: "generating",
  PLAN_READY: "generating",
  GENERATING_RENDERINGS: "generating",
  RENDERINGS_READY: "generating",
  GENERATING_BRIEF: "generating",
  BRIEF_READY: "complete"
};

function getWizardStepByKey(stepKey: WizardStepKey): WizardStep {
  const step = wizardStepByKey.get(stepKey);

  if (!step) {
    throw new Error(`Unknown wizard step: ${stepKey}`);
  }

  return step;
}

export function getProjectStep(status: ProjectStatus): WizardStep {
  const key = statusToStep[status];

  if (!key) {
    throw new Error(`Unknown project status: ${status}`);
  }

  return getWizardStepByKey(key);
}

export function getProjectRoute(projectId: string, status: ProjectStatus) {
  if (status === "FLOOR_PLAN_ANALYZING") {
    return `/projects/${projectId}/analysis/loading`;
  }

  if (status === "AWAITING_PAYMENT" || status === "PAYMENT_PROCESSING" || status === "PAYMENT_SUCCEEDED") {
    return `/projects/${projectId}/payment`;
  }

  return `/projects/${projectId}/${getProjectStep(status).path}`;
}

export function getStepIndex(stepKey: WizardStepKey) {
  const stepIndex = wizardSteps.findIndex((step) => step.key === stepKey);

  if (stepIndex < 0) {
    throw new Error(`Unknown wizard step: ${stepKey}`);
  }

  return stepIndex;
}

function toTransitionKey(from: WizardStepKey, to: WizardStepKey) {
  return `${from}:${to}`;
}

export function getTransitionConfig(from: WizardStepKey, to: WizardStepKey): StageTransitionConfig | null {
  return transitionConfigByKey.get(toTransitionKey(from, to)) ?? null;
}

export function isAutoStageTransition(from: WizardStepKey, to: WizardStepKey): boolean {
  const config = getTransitionConfig(from, to);
  return config?.mode === "auto";
}
