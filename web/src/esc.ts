export type EscOverlay =
  | "lightbox"
  | "settings"
  | "appDialog"
  | "actionModal"
  | "find"
  | "jump"
  | "help"
  | "slash"
  | "history"
  | "sessionPopover"
  | "btw";

export const ESC_OVERLAY_ORDER: readonly EscOverlay[] = [
  "lightbox",
  "settings",
  "appDialog",
  "actionModal",
  "find",
  "jump",
  "help",
  "slash",
  "history",
  "sessionPopover",
  "btw",
];

export type EscArm = { kind: "clear" | "rewind"; at: number } | null;

export type EscAction =
  | { type: "overlay"; overlay: string }
  | { type: "stop" }
  | { type: "recancel" }
  | { type: "arm-clear" }
  | { type: "clear" }
  | { type: "arm-rewind" }
  | { type: "rewind" }
  | { type: "none" };

export function firstOpenEscOverlay(open: Partial<Record<string, boolean>>): string | null {
  for (const id of ESC_OVERLAY_ORDER) {
    if (open[id]) return id;
  }
  return null;
}

export function nextEscAction(input: {
  overlay: string | null;
  turnRunning: boolean;
  canceling: boolean;
  draft: string;
  hasMessages: boolean;
  lastArm: EscArm;
  now: number;
  graceMs?: number;
}): EscAction {
  const graceMs = input.graceMs ?? 1000;
  if (input.overlay) return { type: "overlay", overlay: input.overlay };
  if (input.turnRunning) return { type: "stop" };
  if (input.canceling) return { type: "recancel" };
  const armed =
    input.lastArm && input.now - input.lastArm.at <= graceMs ? input.lastArm.kind : null;
  if (input.draft) {
    return { type: armed === "clear" ? "clear" : "arm-clear" };
  }
  if (input.hasMessages) {
    return { type: armed === "rewind" ? "rewind" : "arm-rewind" };
  }
  return { type: "none" };
}
