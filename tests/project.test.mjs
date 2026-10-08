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
