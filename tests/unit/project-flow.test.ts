import { describe, expect, it } from "vitest";
import {
  getProjectRoute,
  getProjectStep,
  getStepIndex,
  getTransitionConfig,
  isAutoStageTransition,
  wizardSteps
} from "@/lib/projects/flow";

describe("project flow", () => {
  it("maps project statuses to canonical wizard routes", () => {
    const projectId = "p1";

    expect(getProjectRoute(projectId, "CREATED")).toBe("/projects/p1/upload");
    expect(getProjectRoute(projectId, "FLOOR_PLAN_UPLOADING")).toBe("/projects/p1/upload");
    expect(getProjectRoute(projectId, "FLOOR_PLAN_ANALYZING")).toBe("/projects/p1/analysis/loading");
    expect(getProjectRoute(projectId, "FLOOR_PLAN_ANALYZED")).toBe("/projects/p1/analysis");
    expect(getProjectRoute(projectId, "ANALYSIS_CONFIRMED")).toBe("/projects/p1/preferences");
    expect(getProjectRoute(projectId, "PREFERENCES_COLLECTED")).toBe("/projects/p1/interview");
    expect(getProjectRoute(projectId, "INTERVIEWING")).toBe("/projects/p1/interview");
    expect(getProjectRoute(projectId, "INTERVIEW_COMPLETE")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "AWAITING_PAYMENT")).toBe("/projects/p1/payment");
    expect(getProjectRoute(projectId, "PAYMENT_PROCESSING")).toBe("/projects/p1/payment");
    expect(getProjectRoute(projectId, "PAYMENT_SUCCEEDED")).toBe("/projects/p1/payment");
    expect(getProjectRoute(projectId, "GENERATING_REQUIREMENT_PROFILE")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "GENERATING_PLAN")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "PLAN_READY")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "GENERATING_RENDERINGS")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "RENDERINGS_READY")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "GENERATING_BRIEF")).toBe("/projects/p1/generating");
    expect(getProjectRoute(projectId, "BRIEF_READY")).toBe("/projects/p1/complete");
  });

  it("maps statuses to the six visible wizard steps", () => {
    expect(wizardSteps.map((step) => step.label)).toEqual([
      "上传户型图",
      "户型分析",
      "风格预算",
      "设计师咨询",
      "生成中",
      "方案完成"
    ]);

    expect(getProjectStep("CREATED").key).toBe("upload");
    expect(getProjectStep("FLOOR_PLAN_ANALYZING").key).toBe("analysis");
    expect(getProjectStep("ANALYSIS_CONFIRMED").key).toBe("preferences");
    expect(getProjectStep("INTERVIEWING").key).toBe("interview");
    expect(getProjectStep("AWAITING_PAYMENT").key).toBe("generating");
    expect(getProjectStep("PAYMENT_PROCESSING").key).toBe("generating");
    expect(getProjectStep("PAYMENT_SUCCEEDED").key).toBe("generating");
    expect(getProjectStep("GENERATING_PLAN").key).toBe("generating");
    expect(getProjectStep("BRIEF_READY").key).toBe("complete");
  });

  it("returns the zero-based index for a wizard step key", () => {
    expect(getStepIndex("upload")).toBe(0);
    expect(getStepIndex("analysis")).toBe(1);
    expect(getStepIndex("preferences")).toBe(2);
    expect(getStepIndex("interview")).toBe(3);
    expect(getStepIndex("generating")).toBe(4);
    expect(getStepIndex("complete")).toBe(5);
  });

  it("keeps step metadata consistent and fails explicitly for impossible mappings", () => {
    expect(new Set(wizardSteps.map((step) => step.key)).size).toBe(wizardSteps.length);
    expect(wizardSteps.every((step) => step.label.length > 0)).toBe(true);
    expect(wizardSteps.every((step) => getStepIndex(step.key) >= 0)).toBe(true);

    expect(() => getProjectStep("NOT_A_STATUS" as never)).toThrow(/Unknown project status/);
    expect(() => getStepIndex("NOT_A_STEP" as never)).toThrow(/Unknown wizard step/);
  });

  it("exposes stage transition metadata for known transitions", () => {
    expect(getTransitionConfig("analysis", "preferences")?.mode).toBe("auto");
    expect(getTransitionConfig("preferences", "interview")?.mode).toBe("auto");
    expect(getTransitionConfig("interview", "generating")).toMatchObject({
      mode: "confirm",
      title: expect.any(String),
      description: expect.any(String),
      cta: expect.any(String),
      cancel: expect.any(String)
    });
    expect(getTransitionConfig("generating", "complete")?.mode).toBe("auto");
    expect(getTransitionConfig("upload", "analysis")).toBeNull();
    expect(isAutoStageTransition("analysis", "preferences")).toBe(true);
    expect(isAutoStageTransition("interview", "generating")).toBe(false);
  });
});
