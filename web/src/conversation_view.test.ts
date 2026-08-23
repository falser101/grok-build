import assert from "node:assert/strict";
import test from "node:test";
import { USER_THUMB_CAP, userThumbSlice } from "./conversation_view.ts";

test("four or fewer user images all show; extras collapse onto the last thumb", () => {
  assert.deepEqual(userThumbSlice(0), { shown: 0, extra: 0 });
  assert.deepEqual(userThumbSlice(1), { shown: 1, extra: 0 });
  assert.deepEqual(userThumbSlice(USER_THUMB_CAP), { shown: USER_THUMB_CAP, extra: 0 });
  assert.deepEqual(userThumbSlice(5), { shown: USER_THUMB_CAP, extra: 1 });
  assert.deepEqual(userThumbSlice(9), { shown: USER_THUMB_CAP, extra: 5 });
});
