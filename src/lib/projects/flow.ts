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

export const wizardSteps = [
  { key: "upload", label: "上传户型图", path: "upload" },
  { key: "analysis", label: "户型分析", path: "analysis" },
  { key: "preferences", label: "风格预算", path: "preferences" },
  { key: "interview", label: "设计师咨询", path: "interview" },
  { key: "generating", label: "生成中", path: "generating" },
  { key: "complete", label: "方案完成", path: "complete" }
] as const satisfies readonly WizardStep[];

const wizardStepByKey = new Map<WizardStepKey, WizardStep>(wizardSteps.map((step) => [step.key, step]));

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

  return `/projects/${projectId}/${getProjectStep(status).path}`;
}

export function getStepIndex(stepKey: WizardStepKey) {
  const stepIndex = wizardSteps.findIndex((step) => step.key === stepKey);

  if (stepIndex < 0) {
    throw new Error(`Unknown wizard step: ${stepKey}`);
  }

  return stepIndex;
}
