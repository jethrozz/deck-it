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

export function getTransitionRoute(projectId: string): string {
  return `/projects/${projectId}/transition`;
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

  const records = JSON.parse(storage.getItem(TRANSITION_STORAGE_KEY) ?? "{}") as Record<string, ProjectStageTransition>;
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

  const records = JSON.parse(storage.getItem(TRANSITION_STORAGE_KEY) ?? "{}") as Record<string, ProjectStageTransition>;
  const record = records[projectId] ?? null;

  if (!record) {
    return null;
  }

  delete records[projectId];

  if (Object.keys(records).length === 0) {
    storage.removeItem(TRANSITION_STORAGE_KEY);
  } else {
    storage.setItem(TRANSITION_STORAGE_KEY, JSON.stringify(records));
  }

  return record;
}

export function beginStageTransition(input: BeginStageTransitionInput): string {
  const transition = buildStageTransition(input);
  const route = transition ? getTransitionRoute(input.projectId) : getStageRoute(input.projectId, input.to);
  const navigate = input.navigate ?? ((path: string) => window.location.assign(path));

  if (transition) {
    persistStageTransition(transition, input.storage);
  }

  navigate(route);
  return route;
}
