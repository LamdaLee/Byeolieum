import { parseProject, type Project } from "./project.ts";
import {
  parseLibrary,
  type Library,
  MAX_IDEAS,
  firstExperiment,
} from "./library.ts";

export type CloudDocument = { version: 1; project: Project; library: Library };
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(object)
        .sort()
        .map((key) => [key, canonical(object[key])]),
    );
  }
  return value;
}
function sameContent(a: unknown, b: unknown) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}
export function parseCloudDocument(value: unknown): CloudDocument | null {
  if (!value || typeof value !== "object") return null;
  const p = value as Record<string, unknown>;
  if (p.version !== 1) return null;
  const project = parseProject(JSON.stringify(p.project));
  const library = parseLibrary(JSON.stringify(p.library));
  return project && library ? { version: 1, project, library } : null;
}
// Copies are deliberate: colliding IDs with different content never replace cloud records.
export function mergeIntoCloud(
  cloud: CloudDocument,
  local: CloudDocument,
  id: () => string,
  now: string,
): CloudDocument {
  const items = structuredClone(cloud.library.items);
  for (const item of local.library.items) {
    const existing = items.find((c) => c.id === item.id);
    if (
      existing &&
      sameContent(existing.project, item.project) &&
      sameContent(existing.experiment, item.experiment)
    )
      continue;
    items.push({ ...structuredClone(item), id: existing ? id() : item.id });
  }
  const draft = local.project;
  if (
    draft.selected.length >= 2 &&
    draft.brief.title.trim() &&
    !items.some((i) => sameContent(i.project, draft))
  ) {
    items.push({
      id: id(),
      createdAt: now,
      updatedAt: now,
      project: structuredClone(draft),
      experiment: firstExperiment(draft, id()),
    });
  }
  if (items.length > MAX_IDEAS)
    throw new Error(
      "보관함 30개 한도를 넘어요. 먼저 아이디어를 정리한 뒤 가져와 주세요.",
    );
  return { ...structuredClone(cloud), library: { ...cloud.library, items } };
}
