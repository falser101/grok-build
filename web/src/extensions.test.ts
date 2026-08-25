import assert from "node:assert/strict";
import test from "node:test";
import {
  mcpStatusKind,
  mcpToolCountLabel,
  parseMcpList,
  parseSkillsList,
  skillEnabledLabel,
} from "./extensions.ts";

test("skills list is empty without agent rows and never invents names", () => {
  assert.deepEqual(parseSkillsList({}), []);
  assert.deepEqual(parseSkillsList({ skills: [] }), []);
  assert.equal(
    parseSkillsList({ skills: [{ name: "review" }, { name: "filesystem" }] }).length,
    2,
  );
  assert.deepEqual(parseSkillsList({ skills: [{ description: "no name" }] }), []);
});

test("skills list reads enabled and scope as text fields", () => {
  const rows = parseSkillsList({
    result: {
      skills: [
        { name: "user:notes", scope: "user", enabled: false },
        { name: "local-one", scope: "local" },
      ],
    },
  });
  assert.equal(rows[0]?.enabled, false);
  assert.equal(skillEnabledLabel(rows[0]!.enabled), "关");
  assert.equal(rows[1]?.enabled, true);
  assert.equal(skillEnabledLabel(rows[1]!.enabled), "开");
  assert.equal(rows[0]?.source, "user");
});

test("mcp list reads status and tool count, empty without servers", () => {
  assert.deepEqual(parseMcpList({ servers: [] }), []);
  const rows = parseMcpList({
    servers: [
      {
        name: "demo",
        session: {
          status: "ready",
          tools: [{ name: "a" }, { name: "b" }],
        },
      },
      { display_name: "idle-one" },
    ],
  });
  assert.equal(rows[0]?.toolCount, 2);
  assert.equal(mcpToolCountLabel(rows[0]!.toolCount), "2 个工具");
  assert.equal(mcpStatusKind(rows[0]!.status), "ready");
  assert.equal(rows[1]?.name, "idle-one");
  assert.equal(rows[1]?.toolCount, 0);
});
