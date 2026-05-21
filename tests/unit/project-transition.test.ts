// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { ProjectTransitionScreen } from "@/components/project-transition-screen";
import { getTransitionConfig } from "@/lib/projects/flow";
import {
  TRANSITION_STORAGE_KEY,
  beginStageTransition,
  buildStageTransition,
  consumeStageTransition,
  getTransitionFallbackPath,
  getTransitionNextPath,
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

  it("treats malformed transition record as missing and consumes safely", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      TRANSITION_STORAGE_KEY,
      JSON.stringify({
        p6: {
          projectId: "p6",
          from: "interview",
          to: "generating"
        }
      })
    );

    expect(consumeStageTransition("p6", storage)).toBeNull();
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

  it("no-ops when already on the target stage path", () => {
    const storage = new MemoryStorage();
    const visited: string[] = [];
    const previousPath = window.location.pathname;
    try {
      window.history.pushState({}, "", "/projects/p12/preferences");

      const route = beginStageTransition({
        projectId: "p12",
        from: "analysis",
        to: "preferences",
        storage,
        navigate: (path) => visited.push(path)
      });

      expect(route).toBe("/projects/p12/preferences");
      expect(visited).toEqual([]);
      expect(consumeStageTransition("p12", storage)).toBeNull();
    } finally {
      window.history.pushState({}, "", previousPath);
    }
  });

  it("prefers provided nextPath over local transition route mapping", () => {
    const storage = new MemoryStorage();
    const visited: string[] = [];

    const route = beginStageTransition({
      projectId: "p13",
      from: "analysis",
      to: "preferences",
      nextPath: "/projects/p13/preferences?source=server",
      storage,
      navigate: (path) => visited.push(path)
    });

    expect(route).toBe("/projects/p13/transition");
    expect(visited).toEqual(["/projects/p13/transition"]);

    const transition = consumeStageTransition("p13", storage);
    expect(transition).toMatchObject({
      projectId: "p13",
      from: "analysis",
      to: "preferences",
      nextPath: "/projects/p13/preferences?source=server"
    });
    expect(getTransitionNextPath(transition!)).toBe("/projects/p13/preferences?source=server");
  });

  it("normalizes project-local relative nextPath on confirm transitions", async () => {
    const storage = new MemoryStorage();
    const transition = buildStageTransition({
      projectId: "p14",
      from: "interview",
      to: "generating",
      nextPath: "/generating"
    });
    expect(transition).not.toBeNull();
    if (!transition) {
      throw new Error("Expected transition to be built for interview -> generating");
    }

    persistStageTransition(transition, storage);
    const visited: string[] = [];

    render(
      React.createElement(ProjectTransitionScreen, {
        projectId: "p14",
        storage,
        navigate: (path) => visited.push(path)
      })
    );

    fireEvent.click(await screen.findByRole("button", { name: transition.cta ?? "继续" }));

    await waitFor(() => {
      expect(visited).toEqual(["/projects/p14/generating"]);
    });
  });

  it("builds transition next path and fallback path", () => {
    const transition = buildStageTransition({
      projectId: "p7",
      from: "interview",
      to: "generating"
    });

    expect(transition).not.toBeNull();
    if (!transition) {
      throw new Error("Expected transition to be built for interview -> generating");
    }

    expect(getTransitionNextPath(transition)).toBe("/projects/p7/generating");
    expect(getTransitionFallbackPath("p7")).toBe("/projects/p7");
  });

  it("confirm mode triggers onConfirm only after user action", async () => {
    const storage = new MemoryStorage();
    const transition = buildStageTransition({
      projectId: "p8",
      from: "interview",
      to: "generating"
    });
    expect(transition).not.toBeNull();
    if (!transition) {
      throw new Error("Expected transition to be built for interview -> generating");
    }

    persistStageTransition(transition, storage);
    const visited: string[] = [];
    const confirmed: string[] = [];

    render(
      React.createElement(ProjectTransitionScreen, {
        projectId: "p8",
        storage,
        navigate: (path) => visited.push(path),
        onConfirm: (payload) => confirmed.push(payload.projectId)
      })
    );

    await screen.findByRole("button", { name: transition.cta ?? "继续" });
    expect(confirmed).toEqual([]);
    expect(visited).toEqual([]);

    fireEvent.click(screen.getByRole("button", { name: transition.cta ?? "继续" }));

    await waitFor(() => {
      expect(confirmed).toEqual(["p8"]);
      expect(visited).toEqual(["/projects/p8/generating"]);
    });
  });

  it("auto mode redirects after delay", () => {
    vi.useFakeTimers();
    try {
      const storage = new MemoryStorage();
      const transition = buildStageTransition({
        projectId: "p10",
        from: "analysis",
        to: "preferences"
      });
      expect(transition).not.toBeNull();
      if (!transition) {
        throw new Error("Expected transition to be built for analysis -> preferences");
      }

      persistStageTransition(transition, storage);
      const visited: string[] = [];

      render(
        React.createElement(ProjectTransitionScreen, {
          projectId: "p10",
          storage,
          navigate: (path) => visited.push(path)
        })
      );

      expect(visited).toEqual([]);
      vi.advanceTimersByTime(999);
      expect(visited).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(visited).toEqual(["/projects/p10/preferences"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("falls back safely when transition context is missing", async () => {
    const visited: string[] = [];
    const storage = new MemoryStorage();

    render(
      React.createElement(ProjectTransitionScreen, {
        projectId: "p9",
        storage,
        navigate: (path) => visited.push(path)
      })
    );

    await screen.findByText("未找到过渡信息");
    fireEvent.click(screen.getByRole("button", { name: "返回项目" }));
    expect(visited).toContain("/projects/p9");
  });

  it("fallback mode auto-redirects if user does nothing", () => {
    vi.useFakeTimers();
    try {
      const visited: string[] = [];
      const storage = new MemoryStorage();

      render(
        React.createElement(ProjectTransitionScreen, {
          projectId: "p11",
          storage,
          navigate: (path) => visited.push(path)
        })
      );

      expect(screen.getByText("未找到过渡信息")).not.toBeNull();
      expect(visited).toEqual([]);
      vi.advanceTimersByTime(1199);
      expect(visited).toEqual([]);
      vi.advanceTimersByTime(1);
      expect(visited).toEqual(["/projects/p11"]);
    } finally {
      vi.useRealTimers();
    }
  });
});
