import { describe, expect, it } from "vitest";
import { getTransitionConfig } from "@/lib/projects/flow";
import {
  TRANSITION_STORAGE_KEY,
  beginStageTransition,
  buildStageTransition,
  consumeStageTransition,
  getTransitionRoute,
  persistStageTransition
} from "@/lib/projects/transition";

class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string) {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.store.set(key, value);
  }

  removeItem(key: string) {
    this.store.delete(key);
  }
}

describe("project transition helpers", () => {
  it("builds transitions from flow config and rejects unsupported transitions", () => {
    expect(getTransitionConfig("analysis", "preferences")?.mode).toBe("auto");

    expect(
      buildStageTransition({
        projectId: "p1",
        from: "analysis",
        to: "preferences"
      })
    ).toMatchObject({
      projectId: "p1",
      from: "analysis",
      to: "preferences",
      mode: "auto"
    });

    expect(
      buildStageTransition({
        projectId: "p1",
        from: "upload",
        to: "analysis"
      })
    ).toBeNull();
  });

  it("persists and consumes transitions exactly once", () => {
    const storage = new MemoryStorage();
    const transition = buildStageTransition({
      projectId: "p2",
      from: "interview",
      to: "generating"
    });

    expect(transition).not.toBeNull();
    if (!transition) {
      throw new Error("Expected transition to be built for interview -> generating");
    }
    persistStageTransition(transition, storage);

    expect(storage.getItem(TRANSITION_STORAGE_KEY)).toContain("\"p2\"");
    expect(consumeStageTransition("p2", storage)).toMatchObject({
      projectId: "p2",
      from: "interview",
      to: "generating",
      mode: "confirm"
    });
    expect(consumeStageTransition("p2", storage)).toBeNull();
    expect(storage.getItem(TRANSITION_STORAGE_KEY)).toBeNull();
  });

  it("recovers when storage payload is malformed JSON", () => {
    const storage = new MemoryStorage();
    storage.setItem(TRANSITION_STORAGE_KEY, "{invalid json");

    const transition = buildStageTransition({
      projectId: "p4",
      from: "analysis",
      to: "preferences"
    });

    expect(transition).not.toBeNull();
    if (!transition) {
      throw new Error("Expected transition to be built for analysis -> preferences");
    }

    expect(() => persistStageTransition(transition, storage)).not.toThrow();
    expect(consumeStageTransition("p4", storage)).toMatchObject({
      projectId: "p4",
      from: "analysis",
      to: "preferences",
      mode: "auto"
    });
  });

  it("clears malformed/invalid payload shape during consume", () => {
    const storage = new MemoryStorage();
    storage.setItem(TRANSITION_STORAGE_KEY, "\"not-an-object\"");

    expect(consumeStageTransition("p5", storage)).toBeNull();
    expect(storage.getItem(TRANSITION_STORAGE_KEY)).toBeNull();
  });

  it("routes transition flow and fallback flow correctly", () => {
    const storage = new MemoryStorage();
    const visited: string[] = [];

    const transitionRoute = beginStageTransition({
      projectId: "p3",
      from: "analysis",
      to: "preferences",
      storage,
      navigate: (path) => visited.push(path)
    });

    expect(transitionRoute).toBe(getTransitionRoute("p3"));
    expect(visited[0]).toBe("/projects/p3/transition");
    expect(consumeStageTransition("p3", storage)).toMatchObject({
      from: "analysis",
      to: "preferences"
    });

    const fallbackRoute = beginStageTransition({
      projectId: "p3",
      from: "upload",
      to: "analysis",
      storage,
      navigate: (path) => visited.push(path)
    });

    expect(fallbackRoute).toBe("/projects/p3/analysis");
    expect(visited[1]).toBe("/projects/p3/analysis");
    expect(consumeStageTransition("p3", storage)).toBeNull();
  });
});
