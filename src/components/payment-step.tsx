"use client";

import { LoaderCircle, RefreshCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Button, FieldInput, Surface } from "@/components/ui/primitives";

type PaymentOrder = {
  id: string;
  orderNo: string;
  status: string;
  title: string;
  creditsGranted: number;
  originalAmount: number;
  discountAmount: number;
  payableAmount: number;
  contactType: string | null;
  contactValue: string | null;
  couponCodeSnapshot: string | null;
};

type PaymentProjectSnapshot = {
  id: string;
  status: string;
  generationCreditsPurchased: number;
  generationCreditsUsed: number;
  orders?: PaymentOrder[];
};

type QuoteResponse = {
  contact: {
    type: "email" | "phone";
    value: string;
  };
  coupon: {
    id: string;
    code: string;
    isTest: boolean;
  } | null;
  pricing: {
    originalAmount: number;
    discountAmount: number;
    payableAmount: number;
  };
};

type PrepareResponse = {
  order: PaymentOrder | null;
  remainingCredits: number;
  requiresPayment: boolean;
};

type CurrentResponse = {
  projectStatus: string;
  remainingCredits: number;
  requiresPayment: boolean;
  order: PaymentOrder | null;
};

type PayResponse = QuoteResponse & {
  order: PaymentOrder;
  payment: {
    provider: string;
    method: "POST" | string;
    endpoint: string;
    fields: Record<string, string>;
  };
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message.startsWith("<!DOCTYPE html>") || message.startsWith("<html")) {
      return "请求失败，服务暂时没有正确返回内容，请稍后重试。";
    }
    return message || "请求失败，请稍后重试。";
  }

  return "请求失败，请稍后重试。";
}

async function readError(response: Response) {
  const text = (await response.text()).trim();
  if (!text) {
    return `请求失败（${response.status}）`;
  }

  try {
    const parsed = JSON.parse(text) as { error?: string };
    if (parsed && typeof parsed.error === "string" && parsed.error.trim()) {
      return parsed.error;
    }
  } catch {
    return text;
  }

  return text;
}

function formatMoney(value: number) {
  return `¥${value.toFixed(2)}`;
}

const NON_PAYABLE_STATUSES = new Set(["PAID", "FAILED", "EXPIRED", "CANCELED"]);

function isOrderStatusNonPayable(status: string | undefined) {
  if (!status) {
    return true;
  }

  return NON_PAYABLE_STATUSES.has(status);
}

function submitPaymentForm(payment: PayResponse["payment"]) {
  if (payment.method !== "POST") {
    throw new Error("暂不支持当前支付请求方式");
  }

  const form = document.createElement("form");
  form.method = "POST";
  form.action = payment.endpoint;
  form.style.display = "none";

  Object.entries(payment.fields).forEach(([key, value]) => {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = key;
    input.value = value;
    form.appendChild(input);
  });

  document.body.appendChild(form);
  form.submit();
  document.body.removeChild(form);
}

function applyContactFromOrder(
  order: PaymentOrder | null,
  setEmail: Dispatch<SetStateAction<string>>,
  setPhone: Dispatch<SetStateAction<string>>
) {
  if (!order?.contactType || !order.contactValue) {
    return;
  }

  if (order.contactType === "EMAIL") {
    setEmail((current) => current || order.contactValue || "");
    return;
  }

  setPhone((current) => current || order.contactValue || "");
}

export function PaymentStep({ project }: { project: PaymentProjectSnapshot }) {
  const initialOrder = project.orders?.[0] ?? null;
  const initialRemainingCredits = Math.max(0, project.generationCreditsPurchased - project.generationCreditsUsed);

  const [order, setOrder] = useState<PaymentOrder | null>(initialOrder);
  const [remainingCredits, setRemainingCredits] = useState(initialRemainingCredits);
  const [projectStatus, setProjectStatus] = useState(project.status);
  const [email, setEmail] = useState(initialOrder?.contactType === "EMAIL" ? (initialOrder.contactValue ?? "") : "");
  const [phone, setPhone] = useState(initialOrder?.contactType === "PHONE" ? (initialOrder.contactValue ?? "") : "");
  const [couponCode, setCouponCode] = useState(initialOrder?.couponCodeSnapshot ?? "");
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [paying, setPaying] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  const canStartGenerate = remainingCredits > 0;
  const payDisabled = !order || preparing || quoting || paying || isOrderStatusNonPayable(order.status);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const pricing = useMemo(() => {
    if (quote) {
      return quote.pricing;
    }

    if (!order) {
      return null;
    }

    return {
      originalAmount: order.originalAmount,
      discountAmount: order.discountAmount,
      payableAmount: order.payableAmount
    };
  }, [order, quote]);

  async function fetchCurrentOrder(options?: { silent?: boolean }) {
    const silent = options?.silent ?? false;

    if (!silent) {
      setRefreshing(true);
    }

    try {
      const response = await fetch(`/api/projects/${project.id}/orders/current`, { method: "GET" });
      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const payload = (await response.json()) as CurrentResponse;
      if (!isMountedRef.current) {
        return;
      }

      setProjectStatus(payload.projectStatus);
      setRemainingCredits(payload.remainingCredits);
      setOrder(payload.order);

      applyContactFromOrder(payload.order, setEmail, setPhone);

      if (payload.order?.couponCodeSnapshot && !couponCode) {
        setCouponCode(payload.order.couponCodeSnapshot);
      }

      if (payload.remainingCredits > 0) {
        setNotice("支付已完成，已可进入生成流程。");
      }
    } catch (requestError) {
      if (!silent && isMountedRef.current) {
        setError(getErrorMessage(requestError));
      }
    } finally {
      if (!silent && isMountedRef.current) {
        setRefreshing(false);
      }
    }
  }

  useEffect(() => {
    let mounted = true;

    void (async () => {
      setPreparing(true);
      setError(null);

      try {
        const response = await fetch(`/api/projects/${project.id}/orders/prepare`, { method: "POST" });
        if (!response.ok) {
          throw new Error(await readError(response));
        }

        const payload = (await response.json()) as PrepareResponse;
        if (!mounted || !isMountedRef.current) {
          return;
        }

        setRemainingCredits(payload.remainingCredits);
        setOrder(payload.order);
        setProjectStatus(payload.requiresPayment ? "AWAITING_PAYMENT" : "PAYMENT_SUCCEEDED");

        applyContactFromOrder(payload.order, setEmail, setPhone);

        if (payload.order?.couponCodeSnapshot && !couponCode) {
          setCouponCode(payload.order.couponCodeSnapshot);
        }

        if (!payload.requiresPayment) {
          setNotice("当前项目已有可用生成次数，点击下方按钮即可开始生成。");
        }
      } catch (requestError) {
        if (mounted && isMountedRef.current) {
          setError(getErrorMessage(requestError));
        }
      } finally {
        if (mounted && isMountedRef.current) {
          setPreparing(false);
        }
      }

      if (mounted) {
        await fetchCurrentOrder({ silent: true });
      }
    })();

    return () => {
      mounted = false;
    };
  }, [project.id]);

  useEffect(() => {
    if (canStartGenerate) {
      return;
    }

    const timer = window.setInterval(() => {
      void fetchCurrentOrder({ silent: true });
    }, 3500);

    return () => window.clearInterval(timer);
  }, [canStartGenerate, project.id]);

  async function handleQuote() {
    if (!order) {
      setError("订单尚未准备好，请稍后重试。");
      return;
    }

    setQuoting(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/projects/${project.id}/orders/${order.id}/quote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          couponCode: couponCode.trim()
        })
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const payload = (await response.json()) as QuoteResponse;
      setQuote(payload);
      if (payload.coupon) {
        setNotice(`优惠码 ${payload.coupon.code} 已应用。`);
      } else if (couponCode.trim()) {
        setNotice("优惠码未生效，请检查后重试。");
      } else {
        setNotice("已更新订单价格。");
      }
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setQuoting(false);
    }
  }

  async function handlePay() {
    if (!order) {
      setError("订单尚未准备好，请稍后重试。");
      return;
    }

    if (isOrderStatusNonPayable(order.status)) {
      setError("订单状态不允许支付");
      return;
    }

    setPaying(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/projects/${project.id}/orders/${order.id}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          phone,
          couponCode: couponCode.trim()
        })
      });

      if (!response.ok) {
        throw new Error(await readError(response));
      }

      const payload = (await response.json()) as PayResponse;
      setOrder(payload.order);
      setQuote({
        contact: payload.contact,
        coupon: payload.coupon,
        pricing: payload.pricing
      });
      setProjectStatus("PAYMENT_PROCESSING");
      setNotice("已拉起支付，请在支付完成后返回本页面。");
      submitPaymentForm(payload.payment);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_340px]">
      <Surface className="grid gap-5 p-5 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="grid gap-1">
            <h2 className="text-xl font-semibold">订单支付</h2>
            <p className="text-sm text-[var(--muted)]">完成支付后解锁 2 次生成额度，支持重新追问后再次生成。</p>
          </div>
          <div className="rounded-full bg-[var(--panel-soft)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
            {canStartGenerate ? "已可开始生成" : order?.status === "PROCESSING" ? "支付处理中" : "待支付"}
          </div>
        </div>

        {canStartGenerate ? (
          <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] p-4">
            <p className="text-sm leading-6 text-[var(--foreground)]">
              当前可用生成次数：<span className="font-semibold">{remainingCredits}</span>
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">支付完成后，你可以立即进入生成环节。</p>
            <div className="mt-4">
              <Button type="button" onClick={() => window.location.assign(`/projects/${project.id}/generating`)}>
                开始生成
              </Button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 rounded-2xl border border-[var(--line)] p-4">
          <div className="grid gap-2">
            <h3 className="text-base font-semibold">订单信息</h3>
            <p className="text-sm text-[var(--muted)]">用于后续查询的联系方式和优惠码将在本订单里保存。</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="grid gap-2 text-sm">
              <span className="text-[var(--muted)]">邮箱</span>
              <FieldInput
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@example.com"
                disabled={paying || preparing}
              />
            </label>
            <label className="grid gap-2 text-sm">
              <span className="text-[var(--muted)]">手机号</span>
              <FieldInput
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="13800000000"
                disabled={paying || preparing}
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
            <label className="grid gap-2 text-sm">
              <span className="text-[var(--muted)]">优惠码</span>
              <FieldInput
                value={couponCode}
                onChange={(event) => setCouponCode(event.target.value)}
                placeholder="输入优惠码可刷新报价"
                disabled={paying || preparing}
              />
            </label>
            <Button
              type="button"
              variant="secondary"
              className="self-end"
              disabled={!order || quoting || paying || preparing}
              onClick={() => void handleQuote()}
            >
              {quoting ? <LoaderCircle size={16} className="animate-spin" /> : null}
              应用优惠码
            </Button>
          </div>

          <div className="grid gap-2 rounded-2xl bg-[var(--panel-soft)] p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">原价</span>
              <span>{formatMoney(pricing?.originalAmount ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted)]">优惠</span>
              <span>-{formatMoney(pricing?.discountAmount ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--line)] pt-2 text-base font-semibold">
              <span>应付金额</span>
              <span>{formatMoney(pricing?.payableAmount ?? 0)}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              type="button"
              variant="secondary"
              disabled={refreshing || preparing}
              onClick={() => void fetchCurrentOrder()}
            >
              {refreshing ? <LoaderCircle size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
              刷新支付状态
            </Button>
            <Button
              type="button"
              disabled={payDisabled}
              onClick={() => void handlePay()}
            >
              {paying ? <LoaderCircle size={16} className="animate-spin" /> : null}
              {order?.status === "PROCESSING" ? "继续支付" : "立即支付"}
            </Button>
          </div>
        </div>

        {notice ? <p className="text-sm text-[var(--muted)]">{notice}</p> : null}
        {error ? <p className="text-sm text-[#b7443b]">{error}</p> : null}
      </Surface>

      <Surface className="grid h-fit gap-4 p-5">
        <div>
          <h3 className="text-base font-semibold">当前进度</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">付款成功后自动解锁 2 次生成额度。</p>
        </div>
        <div className="grid gap-3 text-sm">
          <SummaryRow label="项目状态" value={projectStatus} />
          <SummaryRow label="剩余次数" value={`${remainingCredits}`} />
          <SummaryRow label="订单号" value={order?.orderNo ?? "未创建"} />
          <SummaryRow label="订单状态" value={order?.status ?? "待准备"} />
        </div>
        {preparing ? (
          <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <LoaderCircle size={16} className="animate-spin" />
            正在准备订单...
          </div>
        ) : null}
      </Surface>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel-soft)] px-4 py-3">
      <div className="text-xs font-medium text-[var(--muted)]">{label}</div>
      <div className="mt-1 text-sm leading-6 text-[var(--foreground)]">{value}</div>
    </div>
  );
}
