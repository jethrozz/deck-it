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
};

export const wizardSteps: WizardStep[] = [
  { key: "upload", label: "上传户型图" },
  { key: "analysis", label: "户型分析" },
  { key: "preferences", label: "风格预算" },
  { key: "interview", label: "设计师咨询" },
  { key: "generating", label: "生成中" },
  { key: "complete", label: "方案完成" }
];

const statusToStep: Record<ProjectStatus, WizardStepKey> = {
  CREATED: "upload",
  FLOOR_PLAN_UPLOADING: "upload",
  FLOOR_PLAN_ANALYZING: "analysis",
  FLOOR_PLAN_ANALYZED: "analysis",
  ANALYSIS_CONFIRMED: "preferences",
  PREFERENCES_COLLECTED: "interview",
  INTERVIEWING: "interview",
  INTERVIEW_COMPLETE: "generating",
  GENERATING_REQUIREMENT_PROFILE: "generating",
  GENERATING_PLAN: "generating",
  PLAN_READY: "generating",
  GENERATING_RENDERINGS: "generating",
  RENDERINGS_READY: "generating",
  GENERATING_BRIEF: "generating",
  BRIEF_READY: "complete"
};

const stepToPath: Record<WizardStepKey, string> = {
  upload: "upload",
  analysis: "analysis",
  preferences: "preferences",
  interview: "interview",
  generating: "generating",
  complete: "complete"
};

export function getProjectStep(status: ProjectStatus): WizardStep {
  const key = statusToStep[status];
  return wizardSteps.find((step) => step.key === key) ?? wizardSteps[0];
}

export function getProjectRoute(projectId: string, status: ProjectStatus) {
  if (status === "FLOOR_PLAN_ANALYZING") {
    return `/projects/${projectId}/analysis/loading`;
  }

  return `/projects/${projectId}/${stepToPath[getProjectStep(status).key]}`;
}

export function getStepIndex(stepKey: WizardStepKey) {
  return wizardSteps.findIndex((step) => step.key === stepKey);
}
