# Order Payment XunhuPay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an order system, coupon support, and XunhuPay integration so projects must be paid before generation starts, each paid bundle grants two generation credits, and exhausted credits trigger repurchase.

**Architecture:** Extend the existing Prisma-backed project workflow with order, coupon, and coupon-redemption models plus project-level purchased/used credit counters. Route interview completion into a dedicated payment page and API set, confirm payment via XunhuPay server-side callbacks, then gate generation through an atomic credit-consumption check before entering the current generation pipeline.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Prisma/PostgreSQL, Vitest, Playwright, XunhuPay HTTP form API

---

## File Structure

### Existing files to modify

- `prisma/schema.prisma`
  Adds order, coupon, coupon-redemption models, new project status values, and project credit counters.
- `src/lib/repositories/project-repository.ts`
  Adds project/order mutations that stay close to the existing repository pattern.
- `src/lib/projects/flow.ts`
  Maps new payment statuses to canonical routes and keeps the six-step wizard behavior consistent.
- `src/lib/projects/load-project.ts`
  Includes current order data and credit counts for server pages.
- `src/app/api/projects/[projectId]/agent/respond/route.ts`
  Sends completed interviews to payment prep instead of directly unlocking generation.
- `src/app/api/projects/[projectId]/generate/route.ts`
  Adds atomic credit-consumption and payment gating before the existing generation pipeline.
- `src/app/projects/[projectId]/interview/page.tsx`
  Allows revisit rules to coexist with payment gating.
- `src/components/interview-panel.tsx`
  Redirects completed interviews to payment instead of generating.
- `src/components/project-steps.tsx`
  Adds payment and repurchase entrypoints for regenerate / return-to-interview flows.
- `package.json`
  Adds any seed/bootstrap script only if absolutely necessary.

### New backend files

- `src/lib/orders/contact.ts`
  Normalizes and validates email / phone identities.
- `src/lib/orders/pricing.ts`
  Computes original price, discounted price, and the `0.01` XunhuPay test-code override.
- `src/lib/orders/coupon-service.ts`
  Loads coupons, checks whitelist, checks prior redemption, and prepares quote/pay decisions.
- `src/lib/orders/bootstrap.ts`
  Upserts the built-in test coupon from env-backed config.
- `src/lib/payments/xunhupay.ts`
  Builds signed request payloads and verifies callback signatures.
- `src/lib/orders/order-service.ts`
  Encapsulates order preparation, quote, pay, callback settlement, and current-order lookups.
- `src/lib/orders/constants.ts`
  Centralizes bundle price, granted credits, and payment provider literals.

### New API routes

- `src/app/api/projects/[projectId]/orders/prepare/route.ts`
- `src/app/api/projects/[projectId]/orders/current/route.ts`
- `src/app/api/projects/[projectId]/orders/[orderId]/quote/route.ts`
- `src/app/api/projects/[projectId]/orders/[orderId]/pay/route.ts`
- `src/app/api/payments/xunhupay/notify/route.ts`

### New UI files

- `src/app/projects/[projectId]/payment/page.tsx`
  Server page for the payment route.
- `src/components/payment-step.tsx`
  Client payment UI, quote application, payment polling, and “start generating” CTA.

### New tests

- `tests/unit/order-pricing.test.ts`
- `tests/unit/order-contact.test.ts`
- `tests/unit/xunhupay.test.ts`
- `tests/unit/order-service.test.ts`
- `tests/unit/project-flow.test.ts`
  Extend current route/status coverage for payment states.
- `tests/e2e/payment-flow.spec.ts`
  Covers interview completion -> payment -> generation and credit exhaustion -> repurchase.

### Environment / docs updates

- `.env.example`
  Documents XunhuPay keys, bundle pricing, and built-in test coupon whitelist config.
- `README.md`
  Documents local payment setup and the test coupon behavior.

---

### Task 1: Expand Prisma schema and repository surfaces

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/repositories/project-repository.ts`
- Test: `tests/unit/project-flow.test.ts`

- [ ] **Step 1: Write the failing route/status test for payment states**

```ts
it("maps payment statuses to canonical routes without adding a visible wizard step", () => {
  const projectId = "p1";

  expect(getProjectRoute(projectId, "AWAITING_PAYMENT")).toBe("/projects/p1/payment");
  expect(getProjectRoute(projectId, "PAYMENT_PROCESSING")).toBe("/projects/p1/payment");
  expect(getProjectRoute(projectId, "PAYMENT_SUCCEEDED")).toBe("/projects/p1/payment");

  expect(getProjectStep("AWAITING_PAYMENT").key).toBe("generating");
  expect(getProjectStep("PAYMENT_PROCESSING").key).toBe("generating");
  expect(getProjectStep("PAYMENT_SUCCEEDED").key).toBe("generating");
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- tests/unit/project-flow.test.ts`
Expected: FAIL because the new `ProjectStatus` values are unknown.

- [ ] **Step 3: Extend Prisma models and status enums**

```prisma
model Project {
  id                         String   @id @default(cuid())
  name                       String
  status                     ProjectStatus @default(CREATED)
  generationCreditsPurchased Int      @default(0)
  generationCreditsUsed      Int      @default(0)
  orders                     Order[]
  // ...keep existing relations
}

model Order {
  id                   String      @id @default(cuid())
  projectId            String
  project              Project     @relation(fields: [projectId], references: [id], onDelete: Cascade)
  orderNo              String      @unique
  provider             PaymentProvider @default(XUNHUPAY)
  providerOrderNo      String?
  title                String
  packageType          OrderPackageType @default(GENERATION_BUNDLE)
  creditsGranted       Int
  originalAmount       Decimal     @db.Decimal(10, 2)
  discountAmount       Decimal     @db.Decimal(10, 2)
  payableAmount        Decimal     @db.Decimal(10, 2)
  status               OrderStatus @default(PENDING)
  contactType          ContactType?
  contactValue         String?
  couponId             String?
  coupon               Coupon?     @relation(fields: [couponId], references: [id], onDelete: SetNull)
  couponCodeSnapshot   String?
  discountRateSnapshot Decimal?    @db.Decimal(5, 2)
  paidAt               DateTime?
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt

  @@index([projectId, status])
}

model Coupon {
  id                   String             @id @default(cuid())
  code                 String             @unique
  discountRate         Decimal            @db.Decimal(5, 2)
  isActive             Boolean            @default(true)
  isTest               Boolean            @default(false)
  allowedContactValues Json?
  minPayableAmount     Decimal?           @db.Decimal(10, 2)
  redemptions          CouponRedemption[]
  orders               Order[]
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt
}

model CouponRedemption {
  id           String      @id @default(cuid())
  couponId     String
  coupon       Coupon      @relation(fields: [couponId], references: [id], onDelete: Cascade)
  orderId      String      @unique
  order        Order       @relation(fields: [orderId], references: [id], onDelete: Cascade)
  contactType  ContactType
  contactValue String
  createdAt    DateTime    @default(now())

  @@unique([couponId, contactType, contactValue])
}

enum ProjectStatus {
  // existing values...
  INTERVIEW_COMPLETE
  AWAITING_PAYMENT
  PAYMENT_PROCESSING
  PAYMENT_SUCCEEDED
  GENERATING_REQUIREMENT_PROFILE
  // ...
}
```

- [ ] **Step 4: Add repository primitives for credits and orders**

```ts
async grantProjectCredits(projectId: string, creditsGranted: number, nextStatus: ProjectStatus) {
  return prisma.project.update({
    where: { id: projectId },
    data: {
      generationCreditsPurchased: { increment: creditsGranted },
      status: nextStatus
    }
  });
},

async consumeProjectCredit(projectId: string) {
  const result = await prisma.project.updateMany({
    where: {
      id: projectId,
      status: { in: ["PAYMENT_SUCCEEDED", "BRIEF_READY", "INTERVIEW_COMPLETE"] },
      generationCreditsPurchased: { gt: prisma.project.fields.generationCreditsUsed }
    },
    data: {
      generationCreditsUsed: { increment: 1 }
    }
  });

  return result.count === 1;
}
```

- [ ] **Step 5: Update project flow mappings**

```ts
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
  // ...
};

export function getProjectRoute(projectId: string, status: ProjectStatus) {
  if (status === "FLOOR_PLAN_ANALYZING") {
    return `/projects/${projectId}/analysis/loading`;
  }

  if (status === "AWAITING_PAYMENT" || status === "PAYMENT_PROCESSING" || status === "PAYMENT_SUCCEEDED") {
    return `/projects/${projectId}/payment`;
  }

  return `/projects/${projectId}/${getProjectStep(status).path}`;
}
```

- [ ] **Step 6: Run tests and Prisma generation**

Run:
- `npm test -- tests/unit/project-flow.test.ts`
- `npm run prisma:generate`

Expected:
- Vitest PASS for route/status coverage
- Prisma client regenerates with no schema errors

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/lib/repositories/project-repository.ts src/lib/projects/flow.ts tests/unit/project-flow.test.ts
git commit -m "feat: add payment order schema and project statuses"
```

### Task 2: Build contact normalization, pricing, coupon bootstrap, and coupon policy tests

**Files:**
- Create: `src/lib/orders/constants.ts`
- Create: `src/lib/orders/contact.ts`
- Create: `src/lib/orders/pricing.ts`
- Create: `src/lib/orders/bootstrap.ts`
- Create: `tests/unit/order-contact.test.ts`
- Create: `tests/unit/order-pricing.test.ts`

- [ ] **Step 1: Write the failing contact normalization tests**

```ts
import { describe, expect, it } from "vitest";
import { normalizeContactIdentity } from "@/lib/orders/contact";

describe("normalizeContactIdentity", () => {
  it("normalizes email identities", () => {
    expect(normalizeContactIdentity("  USER@Example.com ", "")).toEqual({
      type: "email",
      value: "user@example.com"
    });
  });

  it("normalizes phone identities", () => {
    expect(normalizeContactIdentity("", " +86 138-0013-8000 ")).toEqual({
      type: "phone",
      value: "13800138000"
    });
  });
});
```

- [ ] **Step 2: Write the failing pricing and test-coupon tests**

```ts
import { describe, expect, it } from "vitest";
import { calculateOrderPricing } from "@/lib/orders/pricing";

describe("calculateOrderPricing", () => {
  it("applies a fixed discount rate", () => {
    expect(calculateOrderPricing({
      originalAmount: 199,
      coupon: { code: "SAVE20", discountRate: 0.8, isTest: false, minPayableAmount: null }
    })).toMatchObject({
      discountAmount: 39.8,
      payableAmount: 159.2
    });
  });

  it("forces the XunhuPay test coupon to 0.01", () => {
    expect(calculateOrderPricing({
      originalAmount: 199,
      coupon: { code: "TESTPAY", discountRate: 0.8, isTest: true, minPayableAmount: 0.01 }
    }).payableAmount).toBe(0.01);
  });
});
```

- [ ] **Step 3: Run the focused unit tests to verify they fail**

Run: `npm test -- tests/unit/order-contact.test.ts tests/unit/order-pricing.test.ts`
Expected: FAIL because the helpers do not exist yet.

- [ ] **Step 4: Implement constants, contact normalization, and pricing**

```ts
export const ORDER_BUNDLE_PRICE = 199;
export const ORDER_BUNDLE_CREDITS = 2;
export const XUNHUPAY_MIN_TEST_PAYMENT = 0.01;

export function normalizeContactIdentity(email: string, phone: string) {
  const trimmedEmail = email.trim().toLowerCase();
  if (trimmedEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      throw new Error("邮箱格式不正确");
    }
    return { type: "email" as const, value: trimmedEmail };
  }

  const digits = phone.replace(/\D/g, "");
  if (!digits) {
    throw new Error("请填写邮箱或手机号");
  }
  if (digits.length < 11) {
    throw new Error("手机号格式不正确");
  }

  return { type: "phone" as const, value: digits };
}

export function calculateOrderPricing(input: {
  originalAmount: number;
  coupon: { code: string; discountRate: number; isTest: boolean; minPayableAmount: number | null } | null;
}) {
  const discounted = input.coupon ? Number((input.originalAmount * input.coupon.discountRate).toFixed(2)) : input.originalAmount;
  const payableAmount = input.coupon?.isTest
    ? input.coupon.minPayableAmount ?? XUNHUPAY_MIN_TEST_PAYMENT
    : discounted;

  return {
    originalAmount: input.originalAmount,
    discountAmount: Number((input.originalAmount - payableAmount).toFixed(2)),
    payableAmount: Number(payableAmount.toFixed(2))
  };
}
```

- [ ] **Step 5: Implement built-in coupon bootstrap**

```ts
export async function ensureBuiltInCoupons(prisma: PrismaClient) {
  const code = process.env.TEST_COUPON_CODE?.trim();
  if (!code) {
    return;
  }

  const allowed = (process.env.TEST_COUPON_ALLOWED_CONTACTS ?? "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  await prisma.coupon.upsert({
    where: { code },
    update: {
      discountRate: new Prisma.Decimal("0.80"),
      isActive: true,
      isTest: true,
      allowedContactValues: allowed,
      minPayableAmount: new Prisma.Decimal("0.01")
    },
    create: {
      code,
      discountRate: new Prisma.Decimal("0.80"),
      isActive: true,
      isTest: true,
      allowedContactValues: allowed,
      minPayableAmount: new Prisma.Decimal("0.01")
    }
  });
}
```

- [ ] **Step 6: Run the focused unit tests again**

Run: `npm test -- tests/unit/order-contact.test.ts tests/unit/order-pricing.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/lib/orders/constants.ts src/lib/orders/contact.ts src/lib/orders/pricing.ts src/lib/orders/bootstrap.ts tests/unit/order-contact.test.ts tests/unit/order-pricing.test.ts
git commit -m "feat: add order pricing and identity helpers"
```

### Task 3: Add XunhuPay signing, coupon policy enforcement, and order service tests

**Files:**
- Create: `src/lib/payments/xunhupay.ts`
- Create: `src/lib/orders/coupon-service.ts`
- Create: `src/lib/orders/order-service.ts`
- Create: `tests/unit/xunhupay.test.ts`
- Create: `tests/unit/order-service.test.ts`

- [ ] **Step 1: Write the failing XunhuPay signing tests**

```ts
import { describe, expect, it } from "vitest";
import { buildXunhuPayHash, verifyXunhuPayHash } from "@/lib/payments/xunhupay";

describe("xunhupay signing", () => {
  it("builds the same signature for sorted non-empty params", () => {
    const hash = buildXunhuPayHash({
      appid: "app_123",
      trade_order_id: "ORD-1",
      total_fee: "0.01",
      title: "Deck It 2次生成包"
    }, "secret");

    expect(hash).toHaveLength(32);
    expect(verifyXunhuPayHash({
      appid: "app_123",
      trade_order_id: "ORD-1",
      total_fee: "0.01",
      title: "Deck It 2次生成包",
      hash
    }, "secret")).toBe(true);
  });
});
```

- [ ] **Step 2: Write the failing order service tests for coupon reuse and successful settlement**

```ts
it("rejects a coupon when the same normalized contact already redeemed it", async () => {
  await expect(service.quoteOrder({
    projectId: "p1",
    orderId: "o1",
    email: "user@example.com",
    phone: "",
    couponCode: "SAVE20"
  })).rejects.toThrow("该优惠码已被此联系方式使用");
});

it("marks the order paid, grants 2 credits, and records redemption once", async () => {
  const result = await service.settlePaidOrder({
    orderNo: "ORD-1",
    providerOrderNo: "XH-1"
  });

  expect(result.creditsGranted).toBe(2);
  expect(result.projectStatus).toBe("PAYMENT_SUCCEEDED");
});
```

- [ ] **Step 3: Run the focused tests to verify they fail**

Run: `npm test -- tests/unit/xunhupay.test.ts tests/unit/order-service.test.ts`
Expected: FAIL because payment and service modules do not exist.

- [ ] **Step 4: Implement the XunhuPay helper**

```ts
export function buildXunhuPayHash(params: Record<string, string>, appSecret: string) {
  const sorted = Object.keys(params)
    .filter((key) => key !== "hash" && params[key])
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");

  return createHash("md5").update(`${sorted}${appSecret}`).digest("hex");
}

export function verifyXunhuPayHash(params: Record<string, string>, appSecret: string) {
  const { hash = "", ...rest } = params;
  return hash === buildXunhuPayHash(rest, appSecret);
}
```

- [ ] **Step 5: Implement coupon policy and order service primitives**

```ts
export async function resolveCouponForContact(prisma: PrismaClient, code: string, contact: { type: "email" | "phone"; value: string }) {
  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.isActive) {
    throw new Error("优惠码不存在或不可用");
  }

  if (coupon.isTest) {
    const allowed = Array.isArray(coupon.allowedContactValues) ? coupon.allowedContactValues : [];
    if (!allowed.includes(contact.value)) {
      throw new Error("该测试优惠码不适用于当前联系方式");
    }
  }

  const prior = await prisma.couponRedemption.findFirst({
    where: {
      couponId: coupon.id,
      contactType: contact.type,
      contactValue: contact.value
    }
  });

  if (prior) {
    throw new Error("该优惠码已被此联系方式使用");
  }

  return coupon;
}
```

- [ ] **Step 6: Implement paid-order settlement idempotency**

```ts
async settlePaidOrder(input: { orderNo: string; providerOrderNo: string }) {
  return this.prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { orderNo: input.orderNo },
      include: { coupon: true }
    });

    if (!order) {
      throw new Error("订单不存在");
    }

    if (order.status === "PAID") {
      return { creditsGranted: order.creditsGranted, projectStatus: "PAYMENT_SUCCEEDED" as const };
    }

    await tx.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        providerOrderNo: input.providerOrderNo,
        paidAt: new Date()
      }
    });

    await tx.project.update({
      where: { id: order.projectId },
      data: {
        generationCreditsPurchased: { increment: order.creditsGranted },
        status: "PAYMENT_SUCCEEDED"
      }
    });

    if (order.couponId && order.contactType && order.contactValue) {
      await tx.couponRedemption.create({
        data: {
          couponId: order.couponId,
          orderId: order.id,
          contactType: order.contactType,
          contactValue: order.contactValue
        }
      });
    }

    return { creditsGranted: order.creditsGranted, projectStatus: "PAYMENT_SUCCEEDED" as const };
  });
}
```

- [ ] **Step 7: Run the focused tests again**

Run: `npm test -- tests/unit/xunhupay.test.ts tests/unit/order-service.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/lib/payments/xunhupay.ts src/lib/orders/coupon-service.ts src/lib/orders/order-service.ts tests/unit/xunhupay.test.ts tests/unit/order-service.test.ts
git commit -m "feat: add xunhupay order services"
```

### Task 4: Add order APIs and the payment callback route

**Files:**
- Create: `src/app/api/projects/[projectId]/orders/prepare/route.ts`
- Create: `src/app/api/projects/[projectId]/orders/current/route.ts`
- Create: `src/app/api/projects/[projectId]/orders/[orderId]/quote/route.ts`
- Create: `src/app/api/projects/[projectId]/orders/[orderId]/pay/route.ts`
- Create: `src/app/api/payments/xunhupay/notify/route.ts`
- Modify: `src/lib/db.ts` only if a shared helper is needed for transactions
- Test: `tests/unit/order-service.test.ts`

- [ ] **Step 1: Write the failing route-level behavior tests around prepare/pay/notify**

```ts
it("prepareOrder reuses the active pending order for a project with zero remaining credits", async () => {
  const response = await POST(new Request("http://localhost", { method: "POST" }), context);
  expect(response.status).toBe(200);
});

it("notify settles a paid order and returns success even on repeat callbacks", async () => {
  const response = await POST(new Request("http://localhost", {
    method: "POST",
    body: new URLSearchParams({ trade_order_id: "ORD-1", status: "OD", hash: "signed" })
  }));

  expect(await response.text()).toBe("success");
});
```

- [ ] **Step 2: Run the focused unit tests to verify they fail**

Run: `npm test -- tests/unit/order-service.test.ts`
Expected: FAIL because the route layer is still missing.

- [ ] **Step 3: Implement prepare/current/quote/pay routes**

```ts
export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await context.params;
  await ensureBuiltInCoupons(prisma);

  const service = createOrderService(prisma);
  const order = await service.prepareOrder({ projectId });

  return NextResponse.json({
    order,
    remainingCredits: order.remainingCredits,
    nextPath: `/projects/${projectId}/payment`
  });
}
```

```ts
const requestSchema = z.object({
  email: z.string().default(""),
  phone: z.string().default(""),
  couponCode: z.string().trim().optional().default("")
});

export async function POST(request: Request, context: { params: Promise<{ projectId: string; orderId: string }> }) {
  const body = requestSchema.parse(await request.json());
  const { projectId, orderId } = await context.params;

  const quote = await createOrderService(prisma).quoteOrder({
    projectId,
    orderId,
    email: body.email,
    phone: body.phone,
    couponCode: body.couponCode
  });

  return NextResponse.json(quote);
}
```

- [ ] **Step 4: Implement the notify route with form decoding and signature verification**

```ts
export async function POST(request: Request) {
  const formData = await request.formData();
  const payload = Object.fromEntries(formData.entries()) as Record<string, string>;

  if (!verifyXunhuPayHash(payload, process.env.XUNHUPAY_APP_SECRET ?? "")) {
    return new Response("success");
  }

  if (payload.status === "OD") {
    await createOrderService(prisma).settlePaidOrder({
      orderNo: payload.trade_order_id,
      providerOrderNo: payload.transaction_id ?? payload.pay_order_id ?? ""
    });
  }

  return new Response("success");
}
```

- [ ] **Step 5: Run the focused tests again**

Run: `npm test -- tests/unit/order-service.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/api/projects/[projectId]/orders/prepare/route.ts src/app/api/projects/[projectId]/orders/current/route.ts src/app/api/projects/[projectId]/orders/[orderId]/quote/route.ts src/app/api/projects/[projectId]/orders/[orderId]/pay/route.ts src/app/api/payments/xunhupay/notify/route.ts tests/unit/order-service.test.ts
git commit -m "feat: add order payment api routes"
```

### Task 5: Add the payment page and wire interview completion into payment

**Files:**
- Create: `src/app/projects/[projectId]/payment/page.tsx`
- Create: `src/components/payment-step.tsx`
- Modify: `src/app/projects/[projectId]/interview/page.tsx`
- Modify: `src/components/interview-panel.tsx`
- Modify: `src/lib/projects/load-project.ts`
- Test: `tests/unit/interview-panel.test.ts`

- [ ] **Step 1: Write the failing UI test for interview completion redirecting to payment**

```ts
it("redirects completed interviews to the payment route instead of generating", async () => {
  render(<InterviewPanel projectId="p1" status="INTERVIEWING" analysis={analysis} preference={preference} initialConversation={[]} />);

  await user.click(screen.getByRole("button", { name: /发送/i }));

  await waitFor(() => {
    expect(beginStageTransition).toHaveBeenCalledWith(expect.objectContaining({
      projectId: "p1",
      from: "interview",
      to: "generating",
      nextPath: "/projects/p1/payment"
    }));
  });
});
```

- [ ] **Step 2: Run the focused UI test to verify it fails**

Run: `npm test -- tests/unit/interview-panel.test.ts`
Expected: FAIL because interview completion still assumes `/generating`.

- [ ] **Step 3: Extend project detail loading and create the payment page**

```ts
export async function getProjectDetail(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: {
      analysis: true,
      preference: true,
      conversations: { orderBy: { createdAt: "asc" } },
      orders: { orderBy: { createdAt: "desc" }, take: 1 },
      designPlan: true,
      renderings: { orderBy: { createdAt: "asc" } },
      briefExports: { orderBy: { createdAt: "desc" } }
    }
  });
}
```

```tsx
export default async function PaymentPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectDetail(projectId);

  if (!project) {
    return <main className="p-8 text-sm text-[var(--muted)]">项目不存在</main>;
  }

  return (
    <WizardShell currentStep="generating">
      <PaymentStep project={JSON.parse(JSON.stringify(project))} />
    </WizardShell>
  );
}
```

- [ ] **Step 4: Implement `PaymentStep` and update interview completion nextPath**

```tsx
const prepareResponse = await fetch(`/api/projects/${projectId}/orders/prepare`, { method: "POST" }).then((res) => res.json());
setOrder(prepareResponse.order);

const quoteResponse = await fetch(`/api/projects/${projectId}/orders/${order.id}/quote`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, phone, couponCode })
}).then((res) => res.json());

if (order.status === "PAID" || remainingCredits > 0) {
  return <Button onClick={() => window.location.assign(`/projects/${projectId}/generating`)}>开始生成</Button>;
}
```

```ts
if (payload.type === "complete") {
  setCompletedTransition({ nextPath: `/projects/${projectId}/payment` });
  return;
}
```

- [ ] **Step 5: Run the focused UI tests**

Run: `npm test -- tests/unit/interview-panel.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/projects/[projectId]/payment/page.tsx src/components/payment-step.tsx src/app/projects/[projectId]/interview/page.tsx src/components/interview-panel.tsx src/lib/projects/load-project.ts tests/unit/interview-panel.test.ts
git commit -m "feat: add payment page and interview payment handoff"
```

### Task 6: Gate generation, regenerate, and return-to-interview flows by credits

**Files:**
- Modify: `src/app/api/projects/[projectId]/generate/route.ts`
- Modify: `src/app/api/projects/[projectId]/regenerate/route.ts`
- Modify: `src/components/project-workspace.tsx`
- Modify: `src/app/api/projects/[projectId]/agent/respond/route.ts`
- Test: `tests/unit/project-repository.test.ts`
- Test: `tests/unit/project-flow.test.ts`

- [ ] **Step 1: Write the failing generation-gating tests**

```ts
it("rejects generation when payment succeeded but no credits remain", async () => {
  const response = await POST(new Request("http://localhost", { method: "POST" }), context);
  expect(response.status).toBe(402);
});

it("consumes one credit before entering the generation pipeline", async () => {
  const consumed = await repo.consumeProjectCredit("p1");
  expect(consumed).toBe(true);
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- tests/unit/project-repository.test.ts tests/unit/project-flow.test.ts`
Expected: FAIL because credit gating is not implemented.

- [ ] **Step 3: Add atomic credit consumption to the generate route**

```ts
const remainingCredits = project.generationCreditsPurchased - project.generationCreditsUsed;
if (remainingCredits <= 0) {
  return NextResponse.json({ error: "剩余生成次数不足，请先购买新的生成次数包。" }, { status: 402 });
}

const consumed = await repo.consumeProjectCredit(projectId);
if (!consumed) {
  return NextResponse.json({ error: "请先完成支付。" }, { status: 402 });
}

await repo.updateProjectStatus(projectId, "GENERATING_REQUIREMENT_PROFILE");
```

- [ ] **Step 4: Change regenerate and return-to-interview entrypoints**

```ts
if (remainingCredits <= 0) {
  return NextResponse.json({ nextPath: `/projects/${projectId}/payment`, requiresPayment: true }, { status: 402 });
}
```

```tsx
if (response.status === 402) {
  const payload = await response.json();
  window.location.assign(payload.nextPath);
  return;
}
```

- [ ] **Step 5: Preserve the “return to interview then generate” rule**

```ts
await prisma.project.update({
  where: { id: projectId },
  data: {
    status: "INTERVIEWING"
  }
});
```

The revisit itself does not consume a credit. The next successful `/generate` call does.

- [ ] **Step 6: Run the focused tests again**

Run: `npm test -- tests/unit/project-repository.test.ts tests/unit/project-flow.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/app/api/projects/[projectId]/generate/route.ts src/app/api/projects/[projectId]/regenerate/route.ts src/components/project-workspace.tsx src/app/api/projects/[projectId]/agent/respond/route.ts tests/unit/project-repository.test.ts tests/unit/project-flow.test.ts
git commit -m "feat: gate generation by paid credits"
```

### Task 7: Document env setup and add end-to-end coverage for payment + repurchase

**Files:**
- Modify: `.env.example`
- Modify: `README.md`
- Create: `tests/e2e/payment-flow.spec.ts`

- [ ] **Step 1: Write the failing E2E skeleton for payment gating**

```ts
test("requires payment before generation and allows repurchase after credits are exhausted", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("项目名称").fill("支付闭环测试");
  await page.getByRole("button", { name: "开始创建" }).click();

  await expect(page).toHaveURL(/\/projects\/.+\/upload$/);
  // Continue through mocked upload / analysis / preference / interview flow,
  // then assert redirect to /payment before /generating.
});
```

- [ ] **Step 2: Run the E2E file to verify it fails**

Run: `npm run test:e2e -- tests/e2e/payment-flow.spec.ts`
Expected: FAIL because the payment route and gating flow are not fully wired yet.

- [ ] **Step 3: Document the new env vars and test coupon config**

```env
XUNHUPAY_APP_ID=
XUNHUPAY_APP_SECRET=
XUNHUPAY_NOTIFY_URL=
ORDER_BUNDLE_PRICE=199
TEST_COUPON_CODE=TESTPAY
TEST_COUPON_ALLOWED_CONTACTS=test@example.com,13800138000
```

```md
### Payment Configuration

- `XUNHUPAY_APP_ID`
- `XUNHUPAY_APP_SECRET`
- `XUNHUPAY_NOTIFY_URL`
- `ORDER_BUNDLE_PRICE`
- `TEST_COUPON_CODE`
- `TEST_COUPON_ALLOWED_CONTACTS`

The built-in test coupon still goes through XunhuPay, but forces the payable amount to `0.01`.
Only contacts on `TEST_COUPON_ALLOWED_CONTACTS` may use it.
```

- [ ] **Step 4: Implement the end-to-end test against the mock provider path**

```ts
await expect(page).toHaveURL(/\/projects\/.+\/payment$/);
await page.getByLabel("邮箱").fill("test@example.com");
await page.getByLabel("优惠码").fill("TESTPAY");
await page.getByRole("button", { name: "应用优惠码" }).click();
await expect(page.getByText("¥0.01")).toBeVisible();
```

- [ ] **Step 5: Run the full targeted verification set**

Run:
- `npm test -- tests/unit/order-contact.test.ts tests/unit/order-pricing.test.ts tests/unit/xunhupay.test.ts tests/unit/order-service.test.ts tests/unit/project-flow.test.ts tests/unit/project-repository.test.ts tests/unit/interview-panel.test.ts`
- `npm run test:e2e -- tests/e2e/payment-flow.spec.ts`

Expected:
- All targeted Vitest files PASS
- The new Playwright scenario PASSes locally

- [ ] **Step 6: Commit**

```bash
git add .env.example README.md tests/e2e/payment-flow.spec.ts
git commit -m "test: cover payment gating and repurchase flow"
```

---

## Self-Review

### Spec coverage

- Payment gate after interview completion: covered by Tasks 4 and 5.
- Two credits per paid bundle and repurchase after exhaustion: covered by Tasks 1, 3, and 6.
- Coupon-per-contact-per-code enforcement: covered by Tasks 2 and 3.
- Built-in `0.01` real-payment test coupon with whitelist: covered by Tasks 2, 3, and 7.
- XunhuPay server-side signing, callback verification, and idempotent settlement: covered by Tasks 3 and 4.
- UI recovery, current-order polling, and manual “start generating” CTA after payment: covered by Task 5.
- Unit, integration-ish, and E2E coverage: covered by Tasks 2 through 7.

### Placeholder scan

- No `TODO`, `TBD`, or “handle appropriately” placeholders remain.
- Every task includes concrete files, code direction, and commands.

### Type consistency

- Status names are consistently `AWAITING_PAYMENT`, `PAYMENT_PROCESSING`, `PAYMENT_SUCCEEDED`.
- Credit fields are consistently `generationCreditsPurchased` and `generationCreditsUsed`.
- Bundle semantics consistently grant `2` credits per paid order.

