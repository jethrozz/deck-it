import { expect, test } from "@playwright/test";
import type { APIRequestContext, APIResponse } from "@playwright/test";

const onePixelPng = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
  "base64"
);

type AgentTurn =
  | { type: "designer_prompt" | "suggestion"; options?: string[]; recommendation?: string }
  | { type: "complete"; nextPath: string; summary: string };

async function expectOk(response: APIResponse, context: string) {
  if (response.ok()) {
    return;
  }

  const raw = await response.text();
  throw new Error(`${context} failed: [${response.status()}] ${raw}`);
}

async function createProjectId(request: APIRequestContext, namePrefix: string) {
  const response = await request.post("/api/projects", {
    form: { name: `${namePrefix}-${Date.now()}` },
    maxRedirects: 0
  });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);

  const location = response.headers()["location"];
  expect(location).toBeTruthy();

  const matched = location?.match(/\/projects\/([^/]+)\/upload$/);
  expect(matched).toBeTruthy();
  return matched![1];
}

async function setupAnalysisAndPreference(request: APIRequestContext, projectId: string) {
  const upload = await request.post(`/api/projects/${projectId}/floor-plan`, {
    multipart: {
      floorPlan: {
        name: "floor-plan.png",
        mimeType: "image/png",
        buffer: onePixelPng
      }
    }
  });
  await expectOk(upload, "upload floor plan");

  const preferences = await request.post(`/api/projects/${projectId}/preferences`, {
    data: {
      style: "modern_minimal",
      budgetTier: "quality",
      naturalLanguagePreference: "希望客厅更通透，收纳更高效。",
      lifestyleNotes: [],
      hardConstraints: [],
      adoptedSuggestions: [],
      rejectedSuggestions: []
    }
  });
  await expectOk(preferences, "save preferences");
}

async function completeInterview(request: APIRequestContext, projectId: string) {
  const startResponse = await request.post(`/api/projects/${projectId}/agent/respond`, {
    data: {
      action: "start",
      answer: ""
    }
  });
  await expectOk(startResponse, "start interview");

  let turn = (await startResponse.json()) as AgentTurn;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (turn.type === "complete") {
      return turn;
    }

    const candidate =
      (turn.options && turn.options.length > 0 ? turn.options[0] : null) ?? turn.recommendation ?? "按建议继续";

    const answerResponse = await request.post(`/api/projects/${projectId}/agent/respond`, {
      data: {
        action: "answer",
        answer: candidate
      }
    });
    await expectOk(answerResponse, "answer interview");
    turn = (await answerResponse.json()) as AgentTurn;
  }

  throw new Error("Interview did not complete within 12 turns");
}

async function createInterviewCompleteProject(request: APIRequestContext, namePrefix: string) {
  const projectId = await createProjectId(request, namePrefix);
  await setupAnalysisAndPreference(request, projectId);
  const completed = await completeInterview(request, projectId);
  expect(completed.type).toBe("complete");
  return projectId;
}

test("generation is gated by payment and leads to payment page", async ({ page, request }) => {
  test.setTimeout(120000);

  const projectId = await createInterviewCompleteProject(request, "e2e-payment-gate");

  const generateResponse = await request.post(`/api/projects/${projectId}/generate`);
  expect(generateResponse.status()).toBe(402);
  const generatePayload = (await generateResponse.json()) as {
    requiresPayment?: boolean;
    nextPath?: string;
  };
  expect(generatePayload.requiresPayment).toBe(true);
  expect(generatePayload.nextPath).toBe(`/projects/${projectId}/payment`);

  await page.goto(generatePayload.nextPath!);
  await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/payment$`));
  await expect(page.getByRole("heading", { name: "订单支付" })).toBeVisible();
  await expect(page.getByText("完成支付后解锁 2 次生成额度")).toBeVisible();
  await expect(page.getByRole("button", { name: "立即支付" })).toBeVisible();
});

test("regenerate returns repurchase path when credits are exhausted", async ({ request }) => {
  test.setTimeout(120000);

  const projectId = await createInterviewCompleteProject(request, "e2e-repurchase");

  const regenerateResponse = await request.post(`/api/projects/${projectId}/regenerate`);
  expect(regenerateResponse.status()).toBe(402);
  const regeneratePayload = (await regenerateResponse.json()) as {
    requiresPayment?: boolean;
    nextPath?: string;
  };
  expect(regeneratePayload.requiresPayment).toBe(true);
  expect(regeneratePayload.nextPath).toBe(`/projects/${projectId}/payment`);

  const prepareResponse = await request.post(`/api/projects/${projectId}/orders/prepare`);
  await expectOk(prepareResponse, "prepare order");
  const preparePayload = (await prepareResponse.json()) as {
    requiresPayment: boolean;
    remainingCredits: number;
    order: { status: string } | null;
  };
  expect(preparePayload.requiresPayment).toBe(true);
  expect(preparePayload.remainingCredits).toBe(0);
  expect(preparePayload.order).not.toBeNull();
  expect(preparePayload.order?.status).toBe("PENDING");
});
