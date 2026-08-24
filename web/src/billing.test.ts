import assert from "node:assert/strict";
import { test } from "node:test";
import {
  billingChipText,
  billingIsLow,
  formatPrepaidDollars,
  parseBilling,
  periodLabelFromType,
  remainingFromUsed,
} from "./billing.ts";

test("remaining is 100 minus floored used percent", () => {
  assert.equal(remainingFromUsed(42), 58);
  assert.equal(remainingFromUsed(99.9), 1);
  assert.equal(remainingFromUsed(0), 100);
  assert.equal(remainingFromUsed(100), 0);
});

test("parseBilling prefers creditUsagePercent and weekly label", () => {
  const snap = parseBilling({
    config: {
      creditUsagePercent: 42.8,
      currentPeriod: { type: "USAGE_PERIOD_TYPE_WEEKLY", end: "2026-03-31T12:00:00Z" },
      prepaidBalance: { val: -500 },
    },
    subscriptionTier: "SuperGrok",
  });
  assert.equal(snap?.usedPercent, 42.8);
  assert.equal(snap?.remainingPercent, 58);
  assert.equal(snap?.periodLabel, "本周额度");
  assert.equal(snap?.subscriptionTier, "SuperGrok");
  assert.equal(snap?.prepaidDollars, 5);
  assert.equal(billingChipText(snap!), "还剩 58%");
  assert.equal(billingIsLow(snap!), false);
});

test("parseBilling falls back to monthly_limit / used cents", () => {
  const snap = parseBilling({
    result: {
      config: { monthly_limit: { val: 800 }, used: { val: 200 } },
    },
  });
  assert.equal(snap?.usedPercent, 25);
  assert.equal(snap?.remainingPercent, 75);
  assert.equal(periodLabelFromType("USAGE_PERIOD_TYPE_MONTHLY"), "本月额度");
});

test("empty billing is null so the chip stays hidden", () => {
  assert.equal(parseBilling({}), null);
  assert.equal(parseBilling({ config: {} }), null);
  assert.equal(formatPrepaidDollars(199), "$1.99");
});
