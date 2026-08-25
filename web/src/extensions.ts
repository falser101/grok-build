import type { Json } from "./protocol";

export type SkillRow = {
  name: string;
  source: string;
  enabled: boolean;
};

export type McpRow = {
  name: string;
  status: string;
  toolCount: number;
};

function asRecord(value: Json): { [k: string]: Json } | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as { [k: string]: Json })
    : null;
}

function str(rec: { [k: string]: Json } | null, ...keys: string[]): string {
  if (!rec) return "";
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function bool(rec: { [k: string]: Json } | null, ...keys: string[]): boolean | null {
  if (!rec) return null;
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === "boolean") return v;
  }
  return null;
}

export function skillEnabledLabel(enabled: boolean): string {
  return enabled ? "开" : "关";
}

export function parseSkillsList(payload: Json): SkillRow[] {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload);
  const rows = inner?.skills;
  if (!Array.isArray(rows)) return [];
  const out: SkillRow[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    const name = str(r, "name", "displayName", "display_name");
    if (!name) continue;
    const source = str(r, "scope", "source") || "";
    out.push({
      name,
      source,
      enabled: bool(r, "enabled") ?? true,
    });
  }
  return out;
}

export function parseMcpList(payload: Json): McpRow[] {
  const rec = asRecord(payload);
  const inner = asRecord(rec?.result ?? payload);
  const rows = inner?.servers;
  if (!Array.isArray(rows)) return [];
  const out: McpRow[] = [];
  for (const row of rows) {
    const r = asRecord(row);
    const name = str(r, "displayName", "display_name", "name");
    if (!name) continue;
    const session = asRecord(r?.session ?? null);
    const status = str(session, "status") || (session ? "ready" : "");
    const tools = session?.tools;
    const toolCount = Array.isArray(tools) ? tools.length : 0;
    out.push({ name, status, toolCount });
  }
  return out;
}

export function mcpStatusKind(status: string): "ready" | "busy" | "down" | "idle" {
  const s = status.toLowerCase();
  if (s === "ready") return "ready";
  if (s === "initializing") return "busy";
  if (s === "setuprequired" || s === "setup_required" || s === "unavailable") return "down";
  return "idle";
}

export function mcpToolCountLabel(count: number): string {
  return `${count} 个工具`;
}
