import type { Json } from "./protocol.ts";

function asRecord(value: Json | undefined): { [k: string]: Json } | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { [k: string]: Json })
    : null;
}

function asNum(value: Json | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function centVal(value: Json | undefined): number | null {
  if (value == null) return null;
  const n = asNum(value);
  if (n != null) return n;
  const rec = asRecord(value);
  return rec ? asNum(rec.val) : null;
}

export type BillingSnapshot = {
  usedPercent: number;
  remainingPercent: number;
  periodLabel: string;
  resetLabel: string | null;
  prepaidDollars: number | null;
  subscriptionTier: string | null;
  payAsYouGo: boolean;
};

export function remainingFromUsed(usedPercent: number): number {
  const used = Math.floor(Math.min(100, Math.max(0, usedPercent)));
  return Math.max(0, 100 - used);
}

export function periodLabelFromType(periodType: string | null): string {
  const t = (periodType ?? "").toUpperCase();
  if (t.includes("WEEKLY")) return "本周额度";
  if (t.includes("MONTHLY")) return "本月额度";
  return "额度";
}

export function formatResetLabel(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Date(ms).toLocaleString("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatPrepaidDollars(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  if (dollars === 0) return "$0";
  return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

export function billingChipText(snap: BillingSnapshot): string {
  return `还剩 ${snap.remainingPercent}%`;
}

export function billingIsLow(snap: BillingSnapshot): boolean {
  return snap.remainingPercent <= 20;
}

/** TUI `credit_balance_from_config` over `x.ai/billing`. */
export function parseBilling(payload: Json): BillingSnapshot | null {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload) ?? rec;
  const data = asRecord(inner?.data) ?? inner;
  if (!data) return null;
  const config = asRecord(data.config) ?? data;
  const period =
    asRecord(config.currentPeriod) ??
    asRecord(config.current_period) ??
    null;
  const usedPct =
    asNum(config.creditUsagePercent) ??
    asNum(config.credit_usage_percent);
  const limit = centVal(config.monthlyLimit ?? config.monthly_limit);
  const used = centVal(config.used);
  let usage = usedPct;
  if (usage == null && limit != null && limit > 0 && used != null) {
    usage = (used / limit) * 100;
  }
  if (usage == null || !Number.isFinite(usage)) return null;
  const periodType =
    (typeof period?.type === "string" && period.type) ||
    (typeof period?.periodType === "string" && period.periodType) ||
    (typeof period?.period_type === "string" && period.period_type) ||
    null;
  const resetRaw =
    (typeof period?.end === "string" && period.end) ||
    (typeof config.billingPeriodEnd === "string" && config.billingPeriodEnd) ||
    (typeof config.billing_period_end === "string" && config.billing_period_end) ||
    null;
  const prepaid = centVal(config.prepaidBalance ?? config.prepaid_balance);
  const onDemandCap = centVal(config.onDemandCap ?? config.on_demand_cap) ?? 0;
  const tier =
    (typeof data.subscriptionTier === "string" && data.subscriptionTier) ||
    (typeof data.subscription_tier === "string" && data.subscription_tier) ||
    null;
  return {
    usedPercent: usage,
    remainingPercent: remainingFromUsed(usage),
    periodLabel: periodLabelFromType(periodType),
    resetLabel: formatResetLabel(resetRaw),
    prepaidDollars: prepaid != null && Math.abs(prepaid) > 0 ? Math.abs(prepaid) / 100 : null,
    subscriptionTier: tier,
    payAsYouGo: onDemandCap > 0,
  };
}
