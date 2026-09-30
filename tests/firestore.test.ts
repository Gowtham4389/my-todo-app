import { readFileSync } from "node:fs";
import { beforeAll, afterAll, afterEach, describe, it } from "vitest";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { makeTask } from "../src/lib/model";
let env: RulesTestEnvironment;
beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-daymark",
    firestore: {
      host: "127.0.0.1",
      port: 8080,
      rules: readFileSync("firestore.rules", "utf8").replace(
        /uid == '[^']+'/,
        "uid == 'test-owner'",
      ),
    },
  });
});
afterEach(async () => {
  await env.clearFirestore();
});
afterAll(async () => {
  await env?.cleanup();
});
const ref = (uid: string, path = "users/test-owner/tasks/task") =>
  doc(env.authenticatedContext(uid).firestore(), path);
describe("owner access", () => {
  it("permits owner CRUD", async () => {
    const r = ref("test-owner");
    await assertSucceeds(setDoc(r, makeTask("Private", { id: "task" })));
    await assertSucceeds(getDoc(r));
    await assertSucceeds(updateDoc(r, { title: "Changed" }));
    await assertSucceeds(deleteDoc(r));
  });
  it("rejects another user even under their own path", async () => {
    await assertFails(
      setDoc(
        ref("intruder", "users/intruder/tasks/task"),
        makeTask("bad", { id: "task" }),
      ),
    );
    await assertFails(getDoc(ref("intruder")));
    await assertFails(setDoc(ref("intruder"), makeTask("bad", { id: "task" })));
  });
  it("rejects anonymous access and owner access to other user paths", async () => {
    await assertFails(
      getDoc(
        doc(
          env.unauthenticatedContext().firestore(),
          "users/test-owner/tasks/task",
        ),
      ),
    );
    await assertFails(
      setDoc(
        ref("test-owner", "users/another/tasks/task"),
        makeTask("bad", { id: "task" }),
      ),
    );
  });
  it("rejects extra fields and malformed records", async () => {
    await assertFails(
      setDoc(ref("test-owner"), {
        ...makeTask("bad", { id: "task" }),
        admin: true,
      }),
    );
    await assertFails(
      setDoc(ref("test-owner"), makeTask("x".repeat(301), { id: "task" })),
    );
    await assertFails(
      setDoc(
        ref("test-owner"),
        makeTask("bad", {
          id: "task",
          subtasks: [{ id: "a", title: "a", done: "yes" as never }],
        }),
      ),
    );
  });
  it("accepts all 10 validated subtasks and rejects an oversized list", async () => {
    const steps = Array.from({ length: 10 }, (_, i) => ({
      id: `step-${i}`,
      title: `Step ${i}`,
      done: false,
    }));
    await assertSucceeds(
      setDoc(
        ref("test-owner"),
        makeTask("Many small steps", { id: "task", subtasks: steps }),
      ),
    );
    await assertFails(
      updateDoc(ref("test-owner"), {
        subtasks: [...steps, { id: "extra", title: "Extra", done: false }],
      }),
    );
  });
  it("enforces deterministic occurrence IDs and preserves tombstones", async () => {
    const r = ref(
      "test-owner",
      "users/test-owner/occurrences/series_2026-09-01",
    );
    const t = makeTask("Repeat", {
      id: "series_2026-09-01",
      seriesId: "series",
      occurrenceDate: "2026-09-01",
    });
    await assertSucceeds(setDoc(r, t));
    await assertSucceeds(updateDoc(r, { deletedAt: Date.now() }));
    await assertFails(deleteDoc(r));
    await assertFails(
      setDoc(ref("test-owner", "users/test-owner/occurrences/wrong"), {
        ...t,
        id: "wrong",
      }),
    );
  });
});
