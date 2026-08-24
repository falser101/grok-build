export type EscArm = { kind: "clear" | "rewind"; at: number } | null;

export type EscAction =
  | { type: "overlay" }
  | { type: "stop" }
  | { type: "recancel" }
  | { type: "arm-clear" }
  | { type: "clear" }
  | { type: "arm-rewind" }
  | { type: "rewind" }
  | { type: "none" };

export function nextEscAction(input: {
  overlay: string | null;
  turnRunning: boolean;
  canceling: boolean;
  draft: string;
  hasMessages: boolean;
  lastArm: EscArm;
  now: number;
  graceMs: number;
}): EscAction {
  if (input.overlay) return { type: "overlay" };
  if (input.turnRunning) return { type: "stop" };
  if (input.canceling) return { type: "recancel" };
  const armed =
    input.lastArm && input.now - input.lastArm.at <= input.graceMs ? input.lastArm.kind : null;
  if (input.draft) {
    return { type: armed === "clear" ? "clear" : "arm-clear" };
  }
  if (input.hasMessages) {
    return { type: armed === "rewind" ? "rewind" : "arm-rewind" };
  }
  return { type: "none" };
}
