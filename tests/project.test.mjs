import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPrompt,
  parseProject,
  sampleProject,
} from "../src/lib/project.ts";
test("prompt uses only selected source notes and all user requirements", () => {
  const p = structuredClone(sampleProject);
  p.selected = ["sample-1", "sample-3"];
  p.brief.feature = "이름과 연락처를 수집하지 않는다";
  const output = buildPrompt(p);
  assert.ok(output.includes(p.cards[0].text));
  assert.ok(output.includes(p.cards[2].text));
  assert.ok(!output.includes(p.cards[1].text));
  for (const v of Object.values(p.brief)) assert.ok(output.includes(v));
});
test("valid completed work roundtrips without losing edited prompt", () => {
  const p = structuredClone(sampleProject);
  p.selected = ["sample-1", "sample-2"];
  p.step = 3;
  p.prompt = "사용자가 수정한 프롬프트";
  assert.deepEqual(parseProject(JSON.stringify(p)), p);
});
test("invalid local data, duplicate cards, unknown selection and oversized values rejected", () => {
  assert.equal(parseProject("{bad"), null);
  const p = structuredClone(sampleProject);
  p.selected = ["missing"];
  assert.equal(parseProject(JSON.stringify(p)), null);
  p.selected = [];
  p.cards.push(p.cards[0]);
  assert.equal(parseProject(JSON.stringify(p)), null);
  const q = structuredClone(sampleProject);
  q.brief.title = "x".repeat(1001);
  assert.equal(parseProject(JSON.stringify(q)), null);
});
test("restored incomplete projects return to a completable step", () => {
  const p = structuredClone(sampleProject);
  p.step = 3;
  p.prompt = "draft";
  assert.equal(parseProject(JSON.stringify(p))?.step, 1);
  p.selected = ["sample-1", "sample-2"];
  p.brief.check = "";
  assert.equal(parseProject(JSON.stringify(p))?.step, 2);
});

test("older stored projects migrate without losing cards or edited prompt", () => {
  const old = structuredClone(sampleProject);
  delete old.positions;
  delete old.question;
  old.step = 3;
  old.prompt = "기존 결과";
  old.selected = ["sample-1", "sample-3"];
  const restored = parseProject(JSON.stringify(old));
  assert.equal(restored.prompt, "기존 결과");
  assert.equal(restored.question, 0);
  assert.deepEqual(restored.positions, {});
  assert.deepEqual(restored.cards, old.cards);
});
test("invalid optional positions do not erase thought cards", () => {
  const p = structuredClone(sampleProject);
  p.positions = {
    "sample-1": { x: Infinity, y: -20 },
    unknown: { x: 30, y: 40 },
  };
  assert.deepEqual(parseProject(JSON.stringify(p)).positions, {});
});
test("AI inputs reject duplicates, empty notes and excessive cards", async () => {
  const { parseIdeaCards } = await import("../src/lib/project.ts");
  assert.equal(
    parseIdeaCards([
      { id: "a", text: "a" },
      { id: "a", text: "b" },
    ]),
    null,
  );
  assert.equal(
    parseIdeaCards([
      { id: "a", text: " " },
      { id: "b", text: "b" },
    ]),
    null,
  );
  assert.equal(
    parseIdeaCards(
      Array.from({ length: 6 }, (_, i) => ({ id: String(i), text: "note" })),
    ),
    null,
  );
  assert.deepEqual(
    parseIdeaCards([
      { id: "a", text: " hi " },
      { id: "b", text: "b" },
    ]),
    [
      { id: "a", text: "hi" },
      { id: "b", text: "b" },
    ],
  );
});
test("AI results require three grounded ideas with at least two known sources", async () => {
  const { parseIdeas } = await import("../src/lib/project.ts");
  const idea = {
    title: "작은 실험",
    goal: "불편 줄이기",
    audience: "초보자",
    feature: "목록",
    check: "추가하면 보인다",
    reason: "두 메모의 공통점",
    sourceIds: ["sample-1", "sample-3"],
  };
  const good = [
    idea,
    { ...idea, title: "다른 실험" },
    { ...idea, title: "세 번째 실험" },
  ];
  assert.equal(parseIdeas(good, sampleProject.cards).length, 3);
  for (const invalid of [
    { ...idea, sourceIds: ["missing", "sample-1"] },
    { ...idea, sourceIds: ["sample-1"] },
    { ...idea, sourceIds: ["sample-1", "sample-1"] },
    { ...idea, reason: "" },
  ])
    assert.equal(parseIdeas([idea, idea, invalid], sampleProject.cards), null);
  assert.equal(parseIdeas([idea], sampleProject.cards), null);
});
