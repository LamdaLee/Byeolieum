import test from "node:test";
import assert from "node:assert/strict";
import { sampleProject } from "../src/lib/project.ts";
import { firstExperiment } from "../src/lib/library.ts";
import { parseCloudDocument, mergeIntoCloud } from "../src/lib/cloud.ts";
function doc(title = "첫 아이디어") {
  const project = structuredClone(sampleProject);
  project.selected = ["sample-1", "sample-2"];
  project.brief.title = title;
  return {
    version: 1,
    project,
    library: {
      version: 1,
      activeId: "same",
      items: [
        {
          id: "same",
          createdAt: "2026-10-08T00:00:00Z",
          updatedAt: "2026-10-08T00:00:00Z",
          project: structuredClone(project),
          experiment: firstExperiment(project, "check"),
        },
      ],
    },
  };
}
test("cloud documents validate both current draft and archive before restore", () => {
  const original = doc();
  assert.deepEqual(parseCloudDocument(original), original);
  assert.equal(parseCloudDocument({ ...original, version: 2 }), null);
  assert.equal(parseCloudDocument({ ...original, project: {} }), null);
  assert.equal(parseCloudDocument({ ...original, library: {} }), null);
});
test("import merges identical records once and keeps different colliding IDs as copies", () => {
  const cloud = doc(),
    local = doc();
  let id = 0;
  assert.equal(
    mergeIntoCloud(cloud, local, () => `copy-${++id}`, "2026-10-08T00:00:00Z")
      .library.items.length,
    1,
  );
  local.library.items[0].experiment.observed = "다른 결과";
  const merged = mergeIntoCloud(
    cloud,
    local,
    () => `copy-${++id}`,
    "2026-10-08T00:00:00Z",
  );
  assert.equal(merged.library.items.length, 2);
  assert.notEqual(merged.library.items[0].id, merged.library.items[1].id);
  assert.equal(cloud.library.items[0].experiment.observed, "");
  assert.equal(
    merged.library.items[1].experiment.observed,
    local.library.items[0].experiment.observed,
  );
});
test("PostgreSQL JSONB key reordering does not create duplicate imported ideas", () => {
  const cloud = doc(),
    local = doc();
  const reorder = (value) =>
    Array.isArray(value)
      ? value.map(reorder)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .reverse()
              .map((key) => [key, reorder(value[key])]),
          )
        : value;
  const result = mergeIntoCloud(
    reorder(cloud),
    local,
    () => crypto.randomUUID(),
    "2026-10-08T00:00:00Z",
  );
  assert.equal(result.library.items.length, 1);
});
test("import preserves an unsaved named draft without replacing the cloud working project", () => {
  const cloud = doc(),
    local = doc();
  local.project.brief.title = "아직 보관하지 않은 초안";
  const merged = mergeIntoCloud(
    cloud,
    local,
    () => crypto.randomUUID(),
    "2026-10-08T00:00:00Z",
  );
  assert.equal(merged.project.brief.title, cloud.project.brief.title);
  assert.ok(
    merged.library.items.some(
      (i) => i.project.brief.title === local.project.brief.title,
    ),
  );
  assert.ok(parseCloudDocument(merged));
});
test("an overflowing merge throws without deleting any cloud or local idea", () => {
  const cloud = doc();
  cloud.library.items = Array.from({ length: 30 }, (_, i) => ({
    ...cloud.library.items[0],
    id: String(i),
  }));
  const local = doc("다른 아이디어");
  assert.throws(
    () =>
      mergeIntoCloud(
        cloud,
        local,
        () => crypto.randomUUID(),
        "2026-10-08T00:00:00Z",
      ),
    /30개/,
  );
  assert.equal(cloud.library.items.length, 30);
  assert.equal(local.library.items.length, 1);
});
