export type SessionPermMode = "ask" | "plan" | "yolo";

export const SESSION_MODES: SessionPermMode[] = ["ask", "plan", "yolo"];

export function cycleSessionMode(current: SessionPermMode): SessionPermMode {
  const i = SESSION_MODES.indexOf(current);
  return SESSION_MODES[(i + 1) % SESSION_MODES.length]!;
}

export function sessionModeLabel(mode: SessionPermMode): string {
  if (mode === "plan") return "Plan";
  if (mode === "yolo") return "YOLO";
  return "普通";
}

export function acpModeId(mode: SessionPermMode): "default" | "plan" {
  return mode === "plan" ? "plan" : "default";
}

export function parseSessionPermMode(raw: unknown): SessionPermMode | null {
  if (typeof raw !== "string") return null;
  const v = raw.toLowerCase().replace(/[_-]/g, "");
  if (v === "plan" || v === "planmode") return "plan";
  if (v === "yolo" || v === "alwaysapprove" || v === "always" || v === "dangerouslyskippermissions") return "yolo";
  if (v === "ask" || v === "default" || v === "normal" || v === "agent") return "ask";
  return null;
}

export function parseShowPlanChip(payload: unknown): boolean | null {
  const bags: Array<{ [k: string]: unknown } | null> = [];
  const rec =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { [k: string]: unknown })
      : null;
  bags.push(rec);
  const inner =
    rec?.result && typeof rec.result === "object" && !Array.isArray(rec.result)
      ? (rec.result as { [k: string]: unknown })
      : rec;
  bags.push(inner);
  const data =
    inner?.data && typeof inner.data === "object" && !Array.isArray(inner.data)
      ? (inner.data as { [k: string]: unknown })
      : inner;
  bags.push(data);
  const meta =
    data?._meta && typeof data._meta === "object" && !Array.isArray(data._meta)
      ? (data._meta as { [k: string]: unknown })
      : null;
  bags.push(meta);
  for (const bag of bags) {
    if (!bag) continue;
    const v = bag.show_plan_chip ?? bag.showPlanChip ?? bag.showPlanChipAfterExit;
    if (typeof v === "boolean") return v;
    if (v === "1" || v === "true") return true;
    if (v === "0" || v === "false") return false;
  }
  return null;
}

export function planChipVisible(input: { inPlan: boolean; showPlanChip: boolean | null }): boolean {
  if (input.inPlan) return true;
  return input.showPlanChip === true;
}

export function buildSetModeParams(sessionId: string, mode: SessionPermMode): { sessionId: string; modeId: string } {
  return { sessionId, modeId: acpModeId(mode) };
}

export function parseCurrentModeUpdate(payload: unknown): SessionPermMode | null {
  const rec =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as { [k: string]: unknown })
      : null;
  const update =
    rec?.update && typeof rec.update === "object" && !Array.isArray(rec.update)
      ? (rec.update as { [k: string]: unknown })
      : rec;
  const kind = typeof update?.sessionUpdate === "string" ? update.sessionUpdate : "";
  if (kind && kind !== "current_mode_update" && kind !== "mode_update") {
    return parseSessionPermMode(update?.currentModeId ?? update?.modeId ?? update?.mode);
  }
  return parseSessionPermMode(
    update?.currentModeId ?? update?.current_mode_id ?? update?.modeId ?? update?.mode_id ?? update?.mode,
  );
}
