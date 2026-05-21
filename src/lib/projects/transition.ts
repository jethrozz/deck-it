import { getTransitionConfig, wizardSteps, type StageTransitionConfig, type WizardStepKey } from "@/lib/projects/flow";

export const TRANSITION_STORAGE_KEY = "deck-it:project-stage-transition";

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export type ProjectStageTransition = {
  projectId: string;
  from: WizardStepKey;
  to: WizardStepKey;
  mode: StageTransitionConfig["mode"];
  title?: string;
  description?: string;
  cta?: string;
  cancel?: string;
};

type StageTransitionInput = {
  projectId: string;
  from: WizardStepKey;
  to: WizardStepKey;
};

type BeginStageTransitionInput = StageTransitionInput & {
  navigate?: (path: string) => void;
  storage?: StorageLike;
};

function readTransitionRecords(storage: StorageLike): Record<string, ProjectStageTransition> {
  const raw = storage.getItem(TRANSITION_STORAGE_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Record<string, ProjectStageTransition>;
  } catch {
    return {};
  }
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.sessionStorage;
}

function getStageRoute(projectId: string, stepKey: WizardStepKey): string {
  const step = wizardSteps.find((currentStep) => currentStep.key === stepKey);
  return `/projects/${projectId}/${step?.path ?? stepKey}`;
}

function isWizardStepKey(value: unknown): value is WizardStepKey {
  return typeof value === "string" && wizardSteps.some((step) => step.key === value);
}

function isTransitionMode(value: unknown): value is StageTransitionConfig["mode"] {
  return value === "auto" || value === "confirm";
}

function toValidTransition(value: unknown, projectId: string): ProjectStageTransition | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const record = value as Partial<ProjectStageTransition>;

  if (
    record.projectId !== projectId ||
    !isWizardStepKey(record.from) ||
    !isWizardStepKey(record.to) ||
    !isTransitionMode(record.mode)
  ) {
    return null;
  }

  return {
    projectId: record.projectId,
    from: record.from,
    to: record.to,
    mode: record.mode,
    title: typeof record.title === "string" ? record.title : undefined,
    description: typeof record.description === "string" ? record.description : undefined,
    cta: typeof record.cta === "string" ? record.cta : undefined,
    cancel: typeof record.cancel === "string" ? record.cancel : undefined
  };
}

export function getTransitionRoute(projectId: string): string {
  return `/projects/${projectId}/transition`;
}

export function getTransitionNextPath(transition: ProjectStageTransition): string {
  return getStageRoute(transition.projectId, transition.to);
}

export function getTransitionFallbackPath(projectId: string): string {
  return `/projects/${projectId}`;
}

export function buildStageTransition(input: StageTransitionInput): ProjectStageTransition | null {
  const config = getTransitionConfig(input.from, input.to);

  if (!config) {
    return null;
  }

  return {
    projectId: input.projectId,
    from: input.from,
    to: input.to,
    mode: config.mode,
    title: config.title,
    description: config.description,
    cta: config.cta,
    cancel: config.cancel
  };
}

export function persistStageTransition(
  transition: ProjectStageTransition,
  storage: StorageLike | null = getDefaultStorage()
): void {
  if (!storage) {
    return;
  }

  const records = readTransitionRecords(storage);
  records[transition.projectId] = transition;
  storage.setItem(TRANSITION_STORAGE_KEY, JSON.stringify(records));
}

export function consumeStageTransition(
  projectId: string,
  storage: StorageLike | null = getDefaultStorage()
): ProjectStageTransition | null {
  if (!storage) {
    return null;
  }

  const records = readTransitionRecords(storage);
  const record = records[projectId] ?? null;

  if (!record) {
    if (storage.getItem(TRANSITION_STORAGE_KEY) !== null && Object.keys(records).length === 0) {
      storage.removeItem(TRANSITION_STORAGE_KEY);
    }
    return null;
  }

  delete records[projectId];

  if (Object.keys(records).length === 0) {
    storage.removeItem(TRANSITION_STORAGE_KEY);
  } else {
    storage.setItem(TRANSITION_STORAGE_KEY, JSON.stringify(records));
  }

  return toValidTransition(record, projectId);
}

export function beginStageTransition(input: BeginStageTransitionInput): string {
  const targetRoute = getStageRoute(input.projectId, input.to);
  if (typeof window !== "undefined" && window.location.pathname === targetRoute) {
    return targetRoute;
  }

  const transition = buildStageTransition(input);
  const route = transition ? getTransitionRoute(input.projectId) : getStageRoute(input.projectId, input.to);
  const navigate = input.navigate ?? ((path: string) => window.location.assign(path));

  if (transition) {
    persistStageTransition(transition, input.storage);
  }

  navigate(route);
  return route;
}
