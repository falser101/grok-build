export const TURN_COMPLETE_BODY = "回合已结束";

export function turnCompleteNotify(sessionName: string): { title: string; body: string } {
  return { title: sessionName, body: TURN_COMPLETE_BODY };
}

export function windowTitle(input: {
  surface: string;
  running: boolean;
  sessionName: string;
  dashTitle: string;
}): string {
  if (input.surface === "dashboard") return `${input.dashTitle} · Grok Web`;
  if (input.surface === "session") {
    return input.running ? `运行中 · ${input.sessionName}` : input.sessionName;
  }
  return "Grok Web";
}

export function shouldNotifyTurnComplete(input: {
  hidden: boolean;
  permission: string;
}): boolean {
  return input.hidden && input.permission === "granted";
}
