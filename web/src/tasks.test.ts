import assert from "node:assert/strict";
import test from "node:test";
import {
  applyTaskNotice,
  formatTaskDuration,
  parseTaskList,
  parseTaskNotification,
  parseTimestamp,
  parseTaskListResult,
  replaceSessionTasks,
  upsertListedTasks,
  runningTasks,
  sessionHasRunningTasks,
  taskChipText,
  headerTaskChipText,
  tailTaskLog,
  tasksForSession,
} from "./tasks.ts";

test("parse task list prefers display command and marks completed", () => {
  const rows = parseTaskList(
    {
      tasks: [
        {
          task_id: "t1",
          command: "unshare sleep 9",
          display_command: "sleep 9",
          cwd: "/tmp",
          completed: false,
          start_time: { secs_since_epoch: 1700000000, nanos_since_epoch: 0 },
          kind: "bash",
          output: "vite ready\n",
          output_file: "/tmp/t1.log",
        },
        {
          taskId: "t2",
          command: "watch logs",
          monitor_description: "Wait for server",
          completed: true,
          kind: "monitor",
        },
      ],
    },
    "s1",
  );
  assert.equal(rows[0]?.label, "sleep 9");
  assert.equal(rows[0]?.running, true);
  assert.equal(rows[0]?.startedAt, 1700000000 * 1000);
  assert.equal(rows[0]?.output, "vite ready\n");
  assert.equal(rows[0]?.outputFile, "/tmp/t1.log");
  assert.equal(rows[1]?.kind, "monitor");
  assert.equal(rows[1]?.label, "Wait for server");
  assert.equal(rows[1]?.running, false);
});

test("task_backgrounded and task_completed notifications update the store", () => {
  const start = parseTaskNotification("x.ai/task_backgrounded", {
    sessionId: "s1",
    update: {
      sessionUpdate: "task_backgrounded",
      task_id: 4242,
      command: "npm run dev",
      cwd: "/web",
      description: "Restart grok-web",
    },
  });
  assert.equal(start?.type, "start");
  assert.equal(start?.task.id, "4242");
  assert.equal(start?.task.label, "Restart grok-web");
  const store = applyTaskNotice(new Map(), start!);
  assert.equal(runningTasks(store, "s1").length, 1);
  const done = parseTaskNotification("session/update", {
    sessionId: "s1",
    update: {
      sessionUpdate: "task_completed",
      task_snapshot: { task_id: "4242", completed: true, exit_code: 0 },
    },
  });
  applyTaskNotice(store, done!);
  assert.equal(sessionHasRunningTasks(store, "s1"), false);
  assert.equal(tasksForSession(store, "s1")[0]?.exitCode, 0);
});

test("replaceSessionTasks only swaps one session", () => {
  const store = new Map();
  applyTaskNotice(
    store,
    parseTaskNotification("x.ai/task_backgrounded", {
      sessionId: "a",
      update: { sessionUpdate: "task_backgrounded", task_id: "old", command: "a" },
    })!,
  );
  applyTaskNotice(
    store,
    parseTaskNotification("x.ai/task_backgrounded", {
      sessionId: "b",
      update: { sessionUpdate: "task_backgrounded", task_id: "keep", command: "b" },
    })!,
  );
  replaceSessionTasks(store, "a", parseTaskList({ tasks: [{ task_id: "new", command: "c", completed: false }] }, "a"));
  assert.deepEqual(
    [...store.values()].map((t) => t.id).sort(),
    ["keep", "new"],
  );
});

test("empty or failed task/list does not wipe a running task", () => {
  const store = new Map();
  applyTaskNotice(
    store,
    parseTaskNotification("x.ai/task_backgrounded", {
      sessionId: "s1",
      update: { sessionUpdate: "task_backgrounded", task_id: "live", command: "npm run dev" },
    })!,
  );
  upsertListedTasks(store, "s1", parseTaskList({ tasks: [] }, "s1"));
  assert.equal(sessionHasRunningTasks(store, "s1"), true);
  assert.equal(parseTaskListResult(null, "s1").ok, false);
  assert.equal(parseTaskListResult({ result: null, error: "session not found" }, "s1").ok, false);
  upsertListedTasks(
    store,
    "s1",
    parseTaskList({ tasks: [{ task_id: "live", command: "npm run dev", completed: false }] }, "s1"),
  );
  assert.equal(runningTasks(store, "s1")[0]?.running, true);
});

test("duration and chip labels", () => {
  assert.equal(formatTaskDuration(0, 12_000), "12s");
  assert.equal(formatTaskDuration(0, 5 * 60_000), "5m");
  assert.equal(formatTaskDuration(0, 2 * 3600_000 + 4 * 60_000), "2h 4m");
  assert.equal(taskChipText(1), "任务 1");
  assert.equal(taskChipText(3), "任务 3");
  assert.equal(parseTimestamp("2020-01-01T00:00:00.000Z"), Date.parse("2020-01-01T00:00:00.000Z"));
  assert.equal(
    headerTaskChipText(
      [
        {
          id: "t",
          sessionId: "s",
          command: "npm run dev",
          label: "npm run dev",
          cwd: "",
          kind: "bash",
          running: true,
          startedAt: 0,
          endedAt: null,
          exitCode: null,
          signal: null,
          output: "",
          outputFile: "",
        },
      ],
      12_000,
    ),
    "npm run dev · 12s",
  );
  assert.equal(tailTaskLog("abcdef", 4), "cdef");
});
