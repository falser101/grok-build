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

function asId(value: Json | undefined): string | null {
  if (typeof value === "string" && value) return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

export type LiveTaskKind = "bash" | "monitor";

export type LiveTask = {
  id: string;
  sessionId: string;
  command: string;
  label: string;
  cwd: string;
  kind: LiveTaskKind;
  running: boolean;
  startedAt: number | null;
  endedAt: number | null;
  exitCode: number | null;
  signal: string | null;
  output: string;
  outputFile: string;
};

export function taskStoreKey(sessionId: string, taskId: string): string {
  return `${sessionId}\0${taskId}`;
}

export function parseTimestamp(value: Json | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 && value < 1e12 ? value * 1000 : value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n > 0 && n < 1e12 ? n * 1000 : n;
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
  }
  const rec = asRecord(value);
  if (!rec) return null;
  const secs = asNum(rec.secs_since_epoch ?? rec.secsSinceEpoch ?? rec.secs);
  if (secs != null) return secs * 1000;
  const millis = asNum(rec.millis_since_epoch ?? rec.millisSinceEpoch ?? rec.ms);
  return millis;
}

export function formatTaskDuration(startedAt: number | null, now: number, endedAt?: number | null): string {
  if (startedAt == null) return "";
  const end = endedAt ?? now;
  const sec = Math.max(0, Math.floor((end - startedAt) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  if (h < 48) return rm ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return rh ? `${d}d ${rh}h` : `${d}d`;
}

function taskKind(value: Json | undefined, monitorHint: boolean): LiveTaskKind {
  const raw = typeof value === "string" ? value.toLowerCase() : "";
  if (raw === "monitor" || monitorHint) return "monitor";
  return "bash";
}

function taskLabel(command: string, display: string, description: string, kind: LiveTaskKind): string {
  const desc = description.trim();
  if (desc) return desc.replace(/\s+/g, " ");
  const shown = display.trim() || command.trim();
  if (kind === "monitor") return shown || "Monitor";
  return shown || "后台任务";
}

export function parseTaskSnapshot(raw: Json, sessionId: string): LiveTask | null {
  const rec = asRecord(raw);
  if (!rec) return null;
  const id = asId(rec.task_id ?? rec.taskId);
  if (!id) return null;
  const command = typeof rec.command === "string" ? rec.command : "";
  const display = typeof rec.display_command === "string" ? rec.display_command : typeof rec.displayCommand === "string" ? rec.displayCommand : "";
  const description =
    (typeof rec.monitor_description === "string" && rec.monitor_description) ||
    (typeof rec.monitorDescription === "string" && rec.monitorDescription) ||
    (typeof rec.description === "string" && rec.description) ||
    "";
  const kind = taskKind(rec.kind, Boolean(rec.monitor_description || rec.monitorDescription));
  const completed = rec.completed === true;
  return {
    id,
    sessionId,
    command,
    label: taskLabel(command, display, description, kind),
    cwd: typeof rec.cwd === "string" ? rec.cwd : "",
    kind,
    running: !completed,
    startedAt: parseTimestamp(rec.start_time ?? rec.startTime),
    endedAt: parseTimestamp(rec.end_time ?? rec.endTime),
    exitCode: asNum(rec.exit_code ?? rec.exitCode),
    signal: typeof rec.signal === "string" ? rec.signal : null,
    output: typeof rec.output === "string" ? rec.output : "",
    outputFile:
      (typeof rec.output_file === "string" && rec.output_file) ||
      (typeof rec.outputFile === "string" && rec.outputFile) ||
      "",
  };
}

export function parseTaskList(payload: Json, sessionId: string): LiveTask[] {
  return parseTaskListResult(payload, sessionId).tasks;
}

/** `ok: false` means the payload is not a list (error / unknown). Empty `tasks` is still ok. */
export function parseTaskListResult(
  payload: Json,
  sessionId: string,
): { ok: boolean; tasks: LiveTask[] } {
  if (payload == null) return { ok: false, tasks: [] };
  if (Array.isArray(payload)) {
    const tasks: LiveTask[] = [];
    for (const row of payload) {
      const task = parseTaskSnapshot(row, sessionId);
      if (task) tasks.push(task);
    }
    return { ok: true, tasks };
  }
  const rec = asRecord(payload);
  if (!rec) return { ok: false, tasks: [] };
  if (rec.error != null && rec.result == null) return { ok: false, tasks: [] };
  if (Array.isArray(rec.result)) {
    const tasks: LiveTask[] = [];
    for (const row of rec.result) {
      const task = parseTaskSnapshot(row, sessionId);
      if (task) tasks.push(task);
    }
    return { ok: true, tasks };
  }
  const inner = rec.result !== undefined ? asRecord(rec.result as Json) ?? rec : rec;
  const rows = inner?.tasks ?? rec.tasks;
  if (!Array.isArray(rows)) return { ok: false, tasks: [] };
  const tasks: LiveTask[] = [];
  for (const row of rows) {
    const task = parseTaskSnapshot(row, sessionId);
    if (task) tasks.push(task);
  }
  return { ok: true, tasks };
}

export type TaskNotice =
  | { type: "start"; task: LiveTask }
  | { type: "done"; task: LiveTask };

function unwrapUpdate(params: Json): { sessionId: string; update: { [k: string]: Json } } | null {
  const rec = asRecord(params);
  if (!rec) return null;
  const sessionId =
    (typeof rec.sessionId === "string" && rec.sessionId) ||
    (typeof rec.session_id === "string" && rec.session_id) ||
    "";
  const update = asRecord((rec.update as Json) ?? rec);
  if (!update) return null;
  return { sessionId, update };
}

export function parseTaskNotification(method: string, params: Json, fallbackSession = ""): TaskNotice | null {
  const wrap = unwrapUpdate(params);
  if (!wrap) return null;
  const { update } = wrap;
  const sessionId = wrap.sessionId || fallbackSession;
  const kind =
    (typeof update.sessionUpdate === "string" && update.sessionUpdate) ||
    (method.endsWith("task_backgrounded") ? "task_backgrounded" : "") ||
    (method.endsWith("task_completed") ? "task_completed" : "");
  if (kind === "task_backgrounded" || method === "x.ai/task_backgrounded") {
    const snap = parseTaskSnapshot(update, sessionId);
    const id = snap?.id || asId(update.task_id ?? update.taskId);
    if (!id || !sessionId) return null;
    const command = snap?.command || (typeof update.command === "string" ? update.command : "");
    const description =
      (typeof update.monitor_description === "string" && update.monitor_description) ||
      (typeof update.monitorDescription === "string" && update.monitorDescription) ||
      (typeof update.description === "string" && update.description) ||
      "";
    const taskKindValue = taskKind(update.kind, Boolean(update.monitor_description || update.monitorDescription));
    return {
      type: "start",
      task: {
        id,
        sessionId,
        command,
        label: taskLabel(command, "", description, taskKindValue),
        cwd: typeof update.cwd === "string" ? update.cwd : snap?.cwd || "",
        kind: taskKindValue,
        running: true,
        startedAt: snap?.startedAt ?? Date.now(),
        endedAt: null,
        exitCode: null,
        signal: null,
        output: snap?.output ?? "",
        outputFile:
          snap?.outputFile ||
          (typeof update.output_file === "string" ? update.output_file : "") ||
          (typeof update.outputFile === "string" ? update.outputFile : ""),
      },
    };
  }
  if (kind === "task_completed" || method === "x.ai/task_completed") {
    const nested = (update.task_snapshot ?? update.taskSnapshot ?? update) as Json;
    const snap = parseTaskSnapshot(nested, sessionId);
    const id = snap?.id || asId(update.task_id ?? update.taskId);
    if (!id || !sessionId) return null;
    return {
      type: "done",
      task: {
        id,
        sessionId,
        command: snap?.command ?? "",
        label: snap?.label ?? "后台任务",
        cwd: snap?.cwd ?? "",
        kind: snap?.kind ?? "bash",
        running: false,
        startedAt: snap?.startedAt ?? null,
        endedAt: snap?.endedAt ?? Date.now(),
        exitCode: snap?.exitCode ?? null,
        signal: snap?.signal ?? null,
        output: snap?.output ?? "",
        outputFile: snap?.outputFile ?? "",
      },
    };
  }
  return null;
}

export function applyTaskNotice(store: Map<string, LiveTask>, notice: TaskNotice): Map<string, LiveTask> {
  const key = taskStoreKey(notice.task.sessionId, notice.task.id);
  const prev = store.get(key);
  const next: LiveTask = prev
    ? {
        ...prev,
        ...notice.task,
        command: notice.task.command || prev.command,
        label: notice.task.label || prev.label,
        cwd: notice.task.cwd || prev.cwd,
        startedAt: notice.task.startedAt ?? prev.startedAt,
        output: notice.task.output || prev.output,
        outputFile: notice.task.outputFile || prev.outputFile,
      }
    : notice.task;
  if (notice.type === "done") next.running = false;
  store.set(key, next);
  return store;
}

export function replaceSessionTasks(store: Map<string, LiveTask>, sessionId: string, tasks: LiveTask[]): Map<string, LiveTask> {
  for (const key of [...store.keys()]) {
    if (key.startsWith(`${sessionId}\0`)) store.delete(key);
  }
  for (const task of tasks) store.set(taskStoreKey(task.sessionId, task.id), task);
  return store;
}

/**
 * Fold `x.ai/task/list` into the store. Never drop a running task just because
 * the list was empty or omitted it — that flash happens on refresh when the
 * snapshot lags the session replay of `task_backgrounded`.
 */
export function upsertListedTasks(
  store: Map<string, LiveTask>,
  sessionId: string,
  listed: LiveTask[],
): Map<string, LiveTask> {
  for (const task of listed) {
    applyTaskNotice(store, { type: task.running ? "start" : "done", task: { ...task, sessionId } });
  }
  return store;
}

export function tasksForSession(store: Map<string, LiveTask>, sessionId: string | null): LiveTask[] {
  if (!sessionId) return [];
  return [...store.values()]
    .filter((row) => row.sessionId === sessionId)
    .sort((a, b) => Number(b.running) - Number(a.running) || (b.startedAt ?? 0) - (a.startedAt ?? 0));
}

export function runningTasks(store: Map<string, LiveTask>, sessionId?: string | null): LiveTask[] {
  const all = [...store.values()].filter((row) => row.running);
  if (sessionId === undefined) return all;
  if (!sessionId) return [];
  return all.filter((row) => row.sessionId === sessionId);
}

export function sessionHasRunningTasks(store: Map<string, LiveTask>, sessionId: string): boolean {
  return runningTasks(store, sessionId).length > 0;
}

export function taskChipText(count: number): string {
  return count === 1 ? "任务 1" : `任务 ${count}`;
}

/** Top-right header: one running command + duration, or a count. */
export function headerTaskChipText(tasks: LiveTask[], now: number): string {
  if (tasks.length === 0) return "任务";
  if (tasks.length === 1) {
    const row = tasks[0]!;
    const dur = formatTaskDuration(row.startedAt, now);
    let name = row.label.replace(/\s+/g, " ");
    if (name.length > 36) name = `${name.slice(0, 35)}…`;
    return dur ? `${name} · ${dur}` : name;
  }
  return taskChipText(tasks.length);
}

export function tailTaskLog(src: string, max = 120_000): string {
  if (src.length <= max) return src;
  return src.slice(src.length - max);
}

export function buildTaskListParams(sessionId: string): { [k: string]: Json } {
  return { sessionId };
}

export function buildTaskKillParams(sessionId: string, taskId: string): { [k: string]: Json } {
  return { sessionId, taskId, source: "clientUi" };
}
