import test from "node:test";
import assert from "node:assert/strict";
import { sampleProject } from "../src/lib/project.ts";
import {
  firstExperiment,
  parseLibrary,
  canVerify,
  experimentPrompt,
} from "../src/lib/library.ts";
function fixture() {
  const project = structuredClone(sampleProject);
  project.selected = ["sample-1", "sample-3"];
  project.step = 3;
  project.prompt = "사용자가 직접 편집한 프롬프트";
  const item = {
    id: "idea-1",
    createdAt: "2026-10-08T00:00:00Z",
    updatedAt: "2026-10-08T00:00:00Z",
    project,
    experiment: firstExperiment(project, "check-1"),
  };
  return { version: 1, activeId: item.id, items: [item] };
}
test("idea archive roundtrips independent snapshots, edited prompt and experiment records", () => {
  const library = fixture();
  library.items[0].experiment.observed =
    "추가한 항목이 새로고침 뒤에도 남았어요.";
  library.items[0].experiment.checks[0].done = true;
  library.items[0].experiment.status = "verified";
  assert.deepEqual(parseLibrary(JSON.stringify(library)), library);
  assert.equal(sampleProject.selected.length, 0);
});
test("verification requires real observation and every explicit criterion", () => {
  const e = fixture().items[0].experiment;
  assert.equal(canVerify(e), false);
  e.checks[0].done = true;
  assert.equal(canVerify(e), false);
  e.observed = "직접 실행해 확인했어요.";
  assert.equal(canVerify(e), true);
  const task = e.task;
  e.task = " ";
  assert.equal(canVerify(e), false);
  e.task = task;
  e.checks.push({
    id: "second",
    text: "빈 항목은 추가되지 않는다",
    done: false,
  });
  assert.equal(canVerify(e), false);
  e.checks = [];
  assert.equal(canVerify(e), false);
});
test("invalid archives rejected without pretending lost records are an empty library", () => {
  assert.equal(parseLibrary("{broken"), null);
  for (const mutation of [
    (lib) => lib.items.push(lib.items[0]),
    (lib) => lib.items[0].project.selected.push("unknown"),
    (lib) => (lib.items[0].experiment.status = "verified"),
    (lib) =>
      lib.items[0].experiment.checks.push(lib.items[0].experiment.checks[0]),
    (lib) => (lib.items[0].experiment.learned = "x".repeat(1501)),
    (lib) => (lib.items[0].updatedAt = "invalid date"),
  ]) {
    const lib = fixture();
    mutation(lib);
    assert.equal(parseLibrary(JSON.stringify(lib)), null);
  }
});
test("archive limit enforced and missing editing identity recovered safely", () => {
  const lib = fixture();
  lib.activeId = "missing";
  assert.equal(parseLibrary(JSON.stringify(lib)).activeId, null);
  lib.items = Array.from({ length: 31 }, (_, i) => ({
    ...lib.items[0],
    id: String(i),
  }));
  assert.equal(parseLibrary(JSON.stringify(lib)), null);
});
test("experiment help prompt includes actual outcomes and forbids unperformed success claims", () => {
  const item = fixture().items[0];
  item.experiment.observed = "완료 상태가 새로고침 후 사라짐";
  item.experiment.blocker = "저장 위치를 모르겠음";
  const prompt = experimentPrompt(item);
  assert.ok(prompt.includes(item.experiment.observed));
  assert.ok(prompt.includes(item.experiment.blocker));
  assert.ok(prompt.includes(item.project.brief.check));
  assert.ok(prompt.includes("실행하지 않은 테스트가 성공했다고 말하지 마세요"));
});
