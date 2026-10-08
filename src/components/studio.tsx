"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  buildPrompt,
  buildIdeationPrompt,
  emptyProject,
  parseProject,
  parseIdeas,
  sampleProject,
  type Brief,
  type Idea,
  type Project,
} from "@/lib/project";
import Constellation from "./constellation";
import { Mark } from "./mark";
import IdeaLibrary from "./idea-library";
import {
  LIBRARY_KEY,
  MAX_IDEAS,
  emptyLibrary,
  firstExperiment,
  parseLibrary,
  type Library,
  type SavedIdea,
  type Experiment,
} from "@/lib/library";
const KEY = "byeolieum-project-v1";
const stages = ["모으기", "연결하기", "구체화", "프롬프트"];
const questions: {
  key: keyof Brief;
  label: string;
  help: string;
  example: string;
}[] = [
  {
    key: "title",
    label: "이 가능성에 이름을 붙여 볼까요?",
    help: "완벽한 이름이 아니어도 괜찮아요. 만들고 싶은 것을 짧게 표현해요.",
    example: "예: 교육 준비 체크리스트",
  },
  {
    key: "goal",
    label: "어떤 불편을 줄이고 싶나요?",
    help: "연결한 생각의 공통점에서 출발해요. 무엇이 달라지면 좋을까요?",
    example: "예: 준비 항목을 빠뜨리지 않고 확인하기",
  },
  {
    key: "audience",
    label: "누가 사용할까요?",
    help: "처음 사용하는 한 사람을 떠올리면 필요한 기능이 선명해져요.",
    example: "예: 교육을 준비하는 담당자",
  },
  {
    key: "feature",
    label: "작은 기능 하나를 고른다면?",
    help: "첫 버전은 작게. 꼭 있어야 쓸 수 있는 기능부터 정해요.",
    example: "예: 항목 추가·삭제·완료 표시",
  },
  {
    key: "check",
    label: "잘 만들어졌는지 어떻게 확인할까요?",
    help: "직접 해 볼 행동과 기대하는 결과를 적어요. AI 결과를 확인하는 기준이 돼요.",
    example: "예: 항목을 추가한 뒤 새로고침해도 목록이 유지된다.",
  },
];
function signature(p: Project) {
  return JSON.stringify(
    p.cards.filter((c) => p.selected.includes(c.id)).map((c) => [c.id, c.text]),
  );
}
export default function Studio() {
  const [project, setProject] = useState<Project>(emptyProject);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiMessage, setAiMessage] = useState("");
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [showConnectionPrompt, setShowConnectionPrompt] = useState(false);
  const [library, setLibrary] = useState<Library>(emptyLibrary);
  const [libraryReady, setLibraryReady] = useState(false);
  const [libraryBlocked, setLibraryBlocked] = useState(false);
  const [libraryError, setLibraryError] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedIdeaId, setSelectedIdeaId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const drawer = useRef<HTMLElement>(null);
  const abort = useRef<AbortController | null>(null);
  const requestId = useRef(0);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(LIBRARY_KEY);
        if (raw) {
          const restored = parseLibrary(raw);
          if (!restored) {
            setLibraryBlocked(true);
            setLibraryError(
              "보관함 기록을 읽지 못했어요. 기존 기록은 덮어쓰지 않았어요. 현재 생각 작업은 계속할 수 있어요.",
            );
          } else {
            setLibrary(restored);
            setSelectedIdeaId(
              restored.activeId ?? restored.items[0]?.id ?? null,
            );
          }
        }
      } catch {
        setLibraryBlocked(true);
        setLibraryError(
          "브라우저 저장을 사용할 수 없어 보관함을 저장하지 못해요.",
        );
      }
      setLibraryReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!libraryReady || libraryBlocked) return;
    function save() {
      try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
      } catch {
        setLibraryError(
          "보관함을 브라우저에 저장하지 못했어요. ‘보관함 파일 내려받기’로 기록을 보관해 주세요.",
        );
      }
    }
    const timer = setTimeout(save, 250);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [library, libraryReady, libraryBlocked]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const restored = parseProject(raw);
          if (restored) setProject(restored);
          else {
            localStorage.removeItem(KEY);
            setNotice("읽을 수 없는 저장 기록을 초기화했어요.");
          }
        }
      } catch {
        setStorageError(
          "브라우저 저장을 사용할 수 없어요. 프롬프트를 복사해 보관해 주세요.",
        );
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!ready) return;
    function save() {
      try {
        localStorage.setItem(KEY, JSON.stringify(project));
      } catch {
        setStorageError("저장하지 못했어요. 프롬프트를 복사해 보관해 주세요.");
      }
    }
    const timer = setTimeout(save, 250);
    window.addEventListener("pagehide", save);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pagehide", save);
    };
  }, [project, ready]);
  useEffect(() => {
    const control = new AbortController();
    fetch("/api/ideas", { signal: control.signal, cache: "no-store" })
      .then((r) => r.json())
      .then((data) => setAiEnabled(data.enabled === true))
      .catch(() => {});
    return () => {
      control.abort();
      abort.current?.abort();
    };
  }, []);
  const chosen = project.cards.filter((c) => project.selected.includes(c.id));
  const activeIdea = library.items.find((item) => item.id === library.activeId);
  const editorDirty =
    editorOpen &&
    Boolean(note.trim()) &&
    (!editId ||
      note !== project.cards.find((card) => card.id === editId)?.text);
  const canSaveIdea =
    ready &&
    libraryReady &&
    !libraryBlocked &&
    !editorDirty &&
    chosen.length >= 2 &&
    Boolean(project.brief.title.trim());
  const totalPages = Math.max(1, Math.ceil(project.cards.length / 6));
  const actualPage = Math.min(page, totalPages - 1);
  const visible = project.cards.slice(actualPage * 6, actualPage * 6 + 6);
  const question = questions[project.question];
  function stopIdeas() {
    requestId.current++;
    abort.current?.abort();
    abort.current = null;
    setAiBusy(false);
  }
  function update(next: Project) {
    if (signature(next) !== signature(project)) {
      stopIdeas();
      setIdeas([]);
      setAiMessage("");
      if (
        next.idea &&
        (next.idea === project.idea ||
          !next.idea.sourceIds.every((id) => next.selected.includes(id)))
      )
        next = { ...next, idea: undefined };
    }
    setProject(next);
    setNotice("");
    setError("");
  }
  function focusDrawer() {
    requestAnimationFrame(() => {
      drawer.current?.scrollTo({ top: 0, behavior: "instant" });
      heading.current?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 900px)").matches) {
        drawer.current?.scrollIntoView({
          block: "start",
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? "instant"
            : "smooth",
        });
      }
    });
  }
  function go(step: number) {
    setEditorOpen(false);
    update({ ...project, step });
    focusDrawer();
  }
  function saveNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) {
      setError("생각을 한 줄 이상 적어 주세요.");
      return;
    }
    if (!editId && project.cards.length >= 50) {
      setError("카드는 최대 50개까지 저장할 수 있어요.");
      return;
    }
    const cards = editId
      ? project.cards.map((c) =>
          c.id === editId ? { ...c, text: note.trim() } : c,
        )
      : [...project.cards, { id: crypto.randomUUID(), text: note.trim() }];
    update({ ...project, cards });
    setNote("");
    setEditId(null);
    setEditorOpen(false);
    if (!editId) setPage(Math.floor((cards.length - 1) / 6));
  }
  function edit(id: string) {
    const card = project.cards.find((c) => c.id === id);
    if (!card) return;
    setNote(card.text);
    setEditId(id);
    setEditorOpen(true);
    requestAnimationFrame(() => {
      document.getElementById("note")?.focus({ preventScroll: true });
      if (window.matchMedia("(max-width: 900px)").matches)
        drawer.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }
  function add() {
    setEditId(null);
    setNote("");
    setEditorOpen(true);
    requestAnimationFrame(() => document.getElementById("note")?.focus());
  }
  function toggle(id: string) {
    if (project.selected.length >= 5 && !project.selected.includes(id)) {
      setError("한 번에 5개까지 연결할 수 있어요.");
      return;
    }
    update({
      ...project,
      step: 1,
      question: project.step >= 2 ? 0 : project.question,
      prompt: "",
      selected: project.selected.includes(id)
        ? project.selected.filter((x) => x !== id)
        : [...project.selected, id],
    });
  }
  function disconnect() {
    update({ ...project, selected: [], step: 1, question: 0, prompt: "" });
    setNotice("연결을 모두 해제했어요. 생각 카드와 작성한 내용은 유지돼요.");
    setEditorOpen(false);
  }
  function connect() {
    if (project.cards.length < 2) {
      setError("생각 카드를 2개 이상 만들어 주세요.");
      return;
    }
    go(1);
  }
  function startBrief() {
    if (chosen.length < 2) {
      setError("연결할 카드를 2개 이상 선택해 주세요.");
      return;
    }
    update({ ...project, step: 2, question: 0 });
    setEditorOpen(false);
    focusDrawer();
  }
  function advanceQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!project.brief[question.key].trim()) {
      setError("이 질문에 답을 한 줄 적어 주세요.");
      return;
    }
    if (project.question < 4) {
      update({ ...project, question: project.question + 1 });
      focusDrawer();
    } else {
      const missing = questions.findIndex((q) => !project.brief[q.key].trim());
      if (missing !== -1) {
        update({ ...project, question: missing });
        setError("아직 답하지 않은 질문이 있어요.");
        focusDrawer();
        return;
      }
      update({ ...project, step: 3, prompt: buildPrompt(project) });
      focusDrawer();
    }
  }
  function previous() {
    if (project.step === 2 && project.question > 0) {
      update({ ...project, question: project.question - 1 });
      focusDrawer();
    } else go(project.step - 1);
  }
  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setError("");
      setNotice(`${label}를 복사했어요.`);
    } catch {
      setError("복사하지 못했어요. 프롬프트를 직접 선택해서 복사해 주세요.");
    }
  }
  async function askIdeas() {
    if (aiBusy) return;
    if (chosen.length < 2) {
      setError("AI에 보낼 생각 카드를 2개 이상 선택해 주세요.");
      return;
    }
    const snapshot = chosen.map((c) => ({ ...c }));
    const control = new AbortController();
    abort.current = control;
    const id = ++requestId.current;
    setAiBusy(true);
    setAiMessage("");
    setError("");
    try {
      const response = await fetch("/api/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: snapshot }),
        signal: AbortSignal.any([control.signal, AbortSignal.timeout(25000)]),
      });
      const data = await response.json();
      if (id !== requestId.current || control.signal.aborted) return;
      if (!response.ok)
        throw new Error(data.message || "AI 제안을 받지 못했어요.");
      const valid = parseIdeas(data.ideas, snapshot);
      if (!valid) throw new Error("AI 제안의 근거를 확인하지 못했어요.");
      setIdeas(valid);
      setAiMessage(
        "선택한 생각에서 찾은 세 가지 가능성이에요. 근거를 읽고 골라 주세요.",
      );
    } catch (e) {
      if (id !== requestId.current || control.signal.aborted) return;
      setAiMessage(
        e instanceof Error && e.name !== "TimeoutError"
          ? e.message
          : "AI 응답이 늦어요. 직접 아이디어를 정하거나 다시 시도해 주세요.",
      );
    } finally {
      if (id === requestId.current) {
        setAiBusy(false);
        abort.current = null;
      }
    }
  }
  function adopt(idea: Idea) {
    update({
      ...project,
      selected: idea.sourceIds,
      idea,
      brief: {
        title: idea.title,
        goal: idea.goal,
        audience: idea.audience,
        feature: idea.feature,
        check: idea.check,
      },
    });
    setAiMessage("아이디어를 골랐어요. 다음 단계에서 내 상황에 맞게 수정해요.");
  }
  function sample() {
    if (project.cards.length && !window.confirm("현재 작업을 예제로 바꿀까요?"))
      return;
    stopIdeas();
    setIdeas([]);
    setAiMessage("");
    update(structuredClone(sampleProject));
    setLibrary((current) => ({ ...current, activeId: null }));
    setPage(0);
    setNote("");
    setEditId(null);
    setEditorOpen(false);
  }
  function removeCard(id = editId) {
    if (!id) return;
    const selected = project.selected.filter((selectedId) => selectedId !== id);
    update({
      ...project,
      cards: project.cards.filter((card) => card.id !== id),
      selected,
      positions: Object.fromEntries(
        Object.entries(project.positions).filter(([cardId]) => cardId !== id),
      ),
      step: project.step >= 2 && selected.length < 2 ? 1 : project.step,
    });
    if (editId === id) {
      setEditId(null);
      setNote("");
      setEditorOpen(false);
    }
    setNotice("생각 카드 하나를 삭제했어요.");
  }
  function reset() {
    if (!window.confirm("이 브라우저의 카드와 작업을 모두 지울까요?")) return;
    stopIdeas();
    update(structuredClone(emptyProject));
    setLibrary((current) => ({ ...current, activeId: null }));
    setIdeas([]);
    setAiMessage("");
    setNote("");
    setEditId(null);
    setEditorOpen(false);
    setPage(0);
    try {
      localStorage.removeItem(KEY);
    } catch {
      setStorageError("저장 기록을 삭제했는지 확인할 수 없어요.");
    }
    setNotice("현재 작업을 초기화했어요. 보관함의 아이디어는 유지돼요.");
  }
  function saveIdea(openExperiment = false, asNew = false) {
    if (!canSaveIdea) return;
    const existing = asNew ? undefined : activeIdea;
    if (!existing && library.items.length >= MAX_IDEAS) {
      setLibraryError(
        "아이디어는 30개까지 보관할 수 있어요. 파일로 내려받고 불필요한 아이디어를 정리해 주세요.",
      );
      return;
    }
    const id = existing?.id ?? crypto.randomUUID(),
      now = new Date().toISOString();
    const item: SavedIdea = {
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      project: structuredClone(project),
      experiment:
        existing?.experiment ?? firstExperiment(project, crypto.randomUUID()),
    };
    // Writing before changing views makes save failure visible immediately.
    const next: Library = {
      version: 1,
      activeId: id,
      items: existing
        ? library.items.map((i) => (i.id === id ? item : i))
        : [item, ...library.items],
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(project));
      localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
    } catch {
      setLibraryError(
        "아이디어를 저장하지 못했어요. 현재 작업을 유지했어요. 브라우저 저장 공간을 확인해 주세요.",
      );
      return;
    }
    setLibrary(next);
    setLibraryError("");
    setSelectedIdeaId(id);
    setNotice(
      "아이디어를 보관했어요. 첫 실험과 결과 기록으로 이어 갈 수 있어요.",
    );
    if (openExperiment) {
      setLibraryOpen(true);
      window.scrollTo({ top: 0, behavior: "instant" });
    }
  }
  function allowSwitch() {
    const hasDraft =
      project.cards.length > 0 ||
      project.selected.length > 0 ||
      Object.values(project.brief).some((v) => v.trim()) ||
      Boolean(project.prompt);
    if (
      !editorDirty &&
      (!hasDraft ||
        (activeIdea &&
          JSON.stringify(activeIdea.project) === JSON.stringify(project)))
    )
      return true;
    return window.confirm(
      "현재 아이디어의 변경 내용을 아직 보관하지 않았어요. 현재 작업을 바꿀까요? 보관함에 저장한 아이디어는 유지돼요.",
    );
  }
  function newIdea() {
    if (!allowSwitch()) return;
    stopIdeas();
    setIdeas([]);
    setAiMessage("");
    update({
      ...structuredClone(emptyProject),
      cards: project.cards,
      positions: project.positions,
    });
    setLibrary((current) => ({ ...current, activeId: null }));
    setLibraryOpen(false);
    setEditorOpen(false);
    setEditId(null);
    setNote("");
    setPage(0);
    setNotice("생각 카드는 유지하고 새 아이디어를 시작했어요.");
  }
  function resumeIdea(item: SavedIdea) {
    if (!allowSwitch()) return;
    stopIdeas();
    setIdeas([]);
    setAiMessage("");
    update(structuredClone(item.project));
    setLibrary((current) => ({ ...current, activeId: item.id }));
    setLibraryOpen(false);
    setEditorOpen(false);
    setEditId(null);
    setNote("");
    setPage(0);
    setNotice(
      "보관한 아이디어를 불러왔어요. 수정 후 ‘수정본 저장’을 눌러 반영해 주세요.",
    );
  }
  function changeExperiment(id: string, experiment: Experiment) {
    setLibrary((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id
          ? { ...item, experiment, updatedAt: new Date().toISOString() }
          : item,
      ),
    }));
  }
  function deleteIdea(id: string) {
    if (
      !window.confirm(
        "보관한 아이디어와 실험 기록을 삭제할까요? 현재 생각 작업은 유지돼요.",
      )
    )
      return;
    setLibrary((current) => ({
      ...current,
      activeId: current.activeId === id ? null : current.activeId,
      items: current.items.filter((item) => item.id !== id),
    }));
    setSelectedIdeaId(null);
    setNotice("보관함에서 아이디어를 삭제했어요.");
  }
  function exportLibrary() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(library, null, 2)], {
        type: "application/json",
      }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `byeolieum-ideas-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice("보관함 파일을 내려받았어요. 아이디어와 실험 기록이 포함돼요.");
  }
  return (
    <div className={`studio-shell stage-${project.step}`}>
      <a href="#studio-workspace" className="skip-link">
        작업 영역으로 이동
      </a>
      <header className="studio-header">
        <Link href="/" className="brand" aria-label="별이음 홈">
          <Mark />
          <span>
            별이음<small>ByeolIeum</small>
          </span>
        </Link>
        <nav aria-label="제작 단계" className="stage-nav">
          {stages.map((stage, i) => (
            <button
              key={stage}
              disabled={!ready || i > project.step}
              aria-current={project.step === i ? "step" : undefined}
              onClick={() => {
                setLibraryOpen(false);
                go(i);
              }}
            >
              <span>{i < project.step ? "✓" : i + 1}</span>
              {stage}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="save-indicator">
            {storageError ? "브라우저 저장 불가" : "이 브라우저에 저장"}
          </span>
          <button
            className="secondary compact"
            disabled={!libraryReady}
            aria-pressed={libraryOpen}
            onClick={() => {
              setLibraryOpen(!libraryOpen);
              setNotice("");
            }}
          >
            보관함 {library.items.length}
          </button>
          <button onClick={reset} disabled={!ready} className="quiet-button">
            초기화
          </button>
          <button
            className="primary compact"
            onClick={() => {
              setLibraryOpen(false);
              add();
            }}
            disabled={!ready}
          >
            새 생각 ＋
          </button>
        </div>
      </header>
      <main id="studio-workspace" className="studio-main">
        {libraryOpen ? (
          <IdeaLibrary
            key={selectedIdeaId ?? library.items[0]?.id ?? "empty"}
            items={library.items}
            selectedId={selectedIdeaId}
            onSelect={setSelectedIdeaId}
            onResume={resumeIdea}
            onChange={changeExperiment}
            onDelete={deleteIdea}
            onNew={newIdea}
            onClose={() => setLibraryOpen(false)}
            onExport={exportLibrary}
            onCopy={copy}
            error={libraryError || error || storageError}
            notice={notice}
          />
        ) : (
          <>
            <div className="studio-heading">
              <div>
                <p className="eyebrow">YOUR THOUGHTS, NEW POSSIBILITIES</p>
                <h1>
                  {project.step < 2
                    ? "작은 생각에서, 새로운 가능성으로."
                    : project.step === 2
                      ? "아이디어를 한 걸음씩 구체화해요."
                      : "이제 AI와 첫걸음을 만들어요."}
                </h1>
                <p>
                  {project.step < 2
                    ? "카드를 골라 연결해 보세요. 막막한 순간에는 AI가 다른 관점을 제안해요."
                    : "생각의 출발점은 유지하고, 내 상황에 맞게 답을 다듬어 보세요."}
                </p>
              </div>
              <span className="api-state">
                {aiEnabled
                  ? "OpenAI 연결됨"
                  : aiEnabled === false
                    ? "OpenAI 연결 전"
                    : "AI 연결 확인 중"}
              </span>
            </div>
            <div className="work-actions">
              <span>
                {editorDirty
                  ? "편집 중인 생각 카드를 먼저 저장해 주세요."
                  : activeIdea
                    ? `보관한 아이디어 편집 중 · ${activeIdea.project.brief.title}`
                    : "카드를 연결하고 이름을 붙이면 아이디어를 보관할 수 있어요."}
              </span>
              <div>
                <button
                  className="secondary"
                  disabled={!canSaveIdea}
                  onClick={() => saveIdea()}
                >
                  {activeIdea ? "수정본 저장" : "아이디어 저장"}
                </button>
                {activeIdea && (
                  <button
                    className="secondary"
                    disabled={!canSaveIdea}
                    onClick={() => saveIdea(false, true)}
                  >
                    다른 아이디어로 저장
                  </button>
                )}
                <button
                  className="quiet-button"
                  onClick={newIdea}
                  disabled={!ready || !libraryReady}
                >
                  새 아이디어 시작
                </button>
              </div>
            </div>
            {libraryError && (
              <p className="error" role="alert">
                {libraryError}
              </p>
            )}
            <div className="interactive-layout">
              <section className="canvas-area" aria-label="생각 작업 공간">
                {ready && chosen.length > 0 && (
                  <div className="connection-controls">
                    <span>생각 {chosen.length}개 연결 중</span>
                    <div>
                      {project.step >= 2 && (
                        <button type="button" onClick={() => go(1)}>
                          연결 다시 고르기
                        </button>
                      )}
                      <button type="button" onClick={disconnect}>
                        전체 연결 해제
                      </button>
                    </div>
                  </div>
                )}
                <div className="canvas-caption">
                  <span>
                    생각 {project.cards.length}개 · 연결 {chosen.length}개
                  </span>
                  <span className="drag-hint">⠿ 드래그 또는 방향키로 이동</span>
                  <span className="touch-hint">카드를 눌러 연결해요</span>
                </div>
                {!ready ? (
                  <div className="canvas-loading">
                    저장한 생각을 불러오고 있어요…
                  </div>
                ) : (
                  <Constellation
                    cards={visible}
                    selected={project.selected}
                    positions={project.positions}
                    title={project.brief.title}
                    goal={project.brief.goal}
                    onToggle={toggle}
                    onEdit={edit}
                    onDelete={(id) => {
                      if (window.confirm("이 생각 카드를 삭제할까요?"))
                        removeCard(id);
                    }}
                    onMove={(id, pos) =>
                      update({
                        ...project,
                        positions: { ...project.positions, [id]: pos },
                      })
                    }
                    onArrange={() => update({ ...project, positions: {} })}
                    onAdd={add}
                    onConnect={connect}
                  />
                )}
                {totalPages > 1 && (
                  <div className="canvas-pagination">
                    <button
                      disabled={actualPage === 0}
                      onClick={() => setPage(actualPage - 1)}
                    >
                      ← 앞 카드
                    </button>
                    <span>
                      {actualPage + 1} / {totalPages} · 한 화면에 6개씩
                    </span>
                    <button
                      disabled={actualPage === totalPages - 1}
                      onClick={() => setPage(actualPage + 1)}
                    >
                      뒤 카드 →
                    </button>
                  </div>
                )}
                <div className="canvas-footnote">
                  <span>직접 연결 · 기본 기능은 API 없이</span>
                  <span>모바일에서도 선택으로 연결할 수 있어요.</span>
                </div>
              </section>
              <aside
                className="idea-drawer"
                ref={drawer}
                aria-label="아이디어 만들기"
                aria-busy={!ready}
              >
                <div className="drawer-header">
                  <p className="eyebrow">
                    {editorOpen ? "THOUGHT NOTE" : `STEP 0${project.step + 1}`}
                  </p>
                  <h2 ref={heading} tabIndex={-1}>
                    {editorOpen
                      ? editId
                        ? "생각 카드 수정"
                        : "새 생각 남기기"
                      : project.step === 0
                        ? "첫 번째 생각을 남겨요"
                        : project.step === 1
                          ? "이 연결로 무엇을 만들까요?"
                          : project.step === 2
                            ? "조금씩 선명해지는 아이디어"
                            : "내 아이디어의 제작 프롬프트"}
                  </h2>
                </div>
                {ready && (editorOpen || project.step === 0) ? (
                  <>
                    <p className="drawer-description">
                      고민, 발견, 해 보고 싶은 일. 정리되지 않아도 괜찮아요.
                    </p>
                    <form onSubmit={saveNote} className="note-form">
                      <label htmlFor="note">
                        {editId ? "생각 카드 수정" : "새로운 생각"}
                      </label>
                      <textarea
                        id="note"
                        value={note}
                        maxLength={500}
                        rows={5}
                        placeholder="예: 교육생들이 질문하기 어려워해요."
                        onChange={(e) => setNote(e.target.value)}
                      />
                      <div className="form-bottom">
                        <small>{note.length}/500</small>
                        <button className="primary" type="submit">
                          {editId ? "수정 저장" : "카드 추가 ＋"}
                        </button>
                      </div>
                    </form>
                    {editId && (
                      <button
                        className="danger-button"
                        onClick={() => removeCard()}
                      >
                        이 카드 삭제
                      </button>
                    )}
                    {editorOpen ? (
                      <button
                        className="secondary full"
                        onClick={() => {
                          setEditorOpen(false);
                          setEditId(null);
                          setNote("");
                        }}
                      >
                        작업으로 돌아가기
                      </button>
                    ) : (
                      <>
                        <button className="secondary full" onClick={sample}>
                          예제로 체험하기 ↗
                        </button>
                        <button className="primary full" onClick={connect}>
                          생각 연결하기 →
                        </button>
                      </>
                    )}
                  </>
                ) : ready && project.step === 1 ? (
                  <>
                    <p className="drawer-description">
                      생각을 한데 놓았는데 아이디어가 떠오르지 않나요? AI에게
                      연결의 실마리를 물어볼 수 있어요.
                    </p>
                    <div className="source-chips" aria-label="연결한 생각">
                      {chosen.length ? (
                        chosen.map((c, i) => (
                          <div key={c.id}>
                            <span>{i + 1}</span>
                            <p>{c.text}</p>
                          </div>
                        ))
                      ) : (
                        <p className="small-muted">카드 2~5개를 골라 주세요.</p>
                      )}
                    </div>
                    <div className="ai-action">
                      <button
                        className="primary full"
                        disabled={aiBusy || chosen.length < 2}
                        onClick={askIdeas}
                      >
                        {aiBusy ? (
                          <>
                            <span className="spinner" />
                            가능성을 찾고 있어요…
                          </>
                        ) : (
                          "✦ AI 아이디어 3개 제안받기"
                        )}
                      </button>
                      <p>
                        선택한 카드만 OpenAI에 전송돼요. 개인정보는 빼 주세요.
                        요청에 따라 API 비용이 발생할 수 있어요.
                      </p>
                      {aiBusy && (
                        <button
                          className="quiet-button"
                          onClick={() => {
                            stopIdeas();
                            setAiMessage("제안 요청을 취소했어요.");
                          }}
                        >
                          요청 취소
                        </button>
                      )}
                    </div>
                    {aiMessage && (
                      <p className="ai-message" role="status">
                        {aiMessage}
                      </p>
                    )}
                    <div className="idea-candidates">
                      {ideas.map((idea, i) => (
                        <article
                          className="idea-candidate"
                          key={`${idea.title}-${i}`}
                        >
                          <small>가능성 0{i + 1}</small>
                          <h3>{idea.title}</h3>
                          <p>{idea.goal}</p>
                          <details>
                            <summary>연결 근거 확인</summary>
                            <p>{idea.reason}</p>
                            <ul>
                              {idea.sourceIds.map((id) => (
                                <li key={id}>
                                  {project.cards.find((c) => c.id === id)?.text}
                                </li>
                              ))}
                            </ul>
                            <p className="small-muted">
                              가설이에요. 내 상황에 맞는지 직접 확인하세요.
                            </p>
                          </details>
                          <button
                            className="secondary full"
                            onClick={() => adopt(idea)}
                          >
                            이 아이디어 선택
                          </button>
                        </article>
                      ))}
                    </div>
                    {project.idea && (
                      <div className="adopted-idea">
                        <small>선택한 가능성</small>
                        <strong>{project.idea.title}</strong>
                        <p>{project.idea.reason}</p>
                      </div>
                    )}
                    <button
                      className="secondary full"
                      disabled={chosen.length < 2}
                      onClick={startBrief}
                    >
                      {project.idea
                        ? "이 아이디어 구체화 →"
                        : "직접 아이디어 정하기 →"}
                    </button>
                    <button
                      className="quiet-button full"
                      disabled={chosen.length < 2}
                      onClick={() =>
                        setShowConnectionPrompt(!showConnectionPrompt)
                      }
                    >
                      다른 AI에서 아이디어 찾기{" "}
                      {showConnectionPrompt ? "−" : "＋"}
                    </button>
                    {showConnectionPrompt && (
                      <div className="external-prompt">
                        <label htmlFor="connection-prompt">
                          아이디어 연결 프롬프트
                        </label>
                        <textarea
                          id="connection-prompt"
                          readOnly
                          value={buildIdeationPrompt(chosen)}
                          rows={7}
                        />
                        <button
                          className="secondary full"
                          onClick={() =>
                            copy(buildIdeationPrompt(chosen), "연결 프롬프트")
                          }
                        >
                          연결 프롬프트 복사
                        </button>
                      </div>
                    )}
                  </>
                ) : ready && project.step === 2 ? (
                  <>
                    <div className="question-progress">
                      <span>{project.question + 1} / 5</span>
                      <div>
                        {questions.map((q, i) => (
                          <span
                            key={q.key}
                            className={i <= project.question ? "filled" : ""}
                          />
                        ))}
                      </div>
                    </div>
                    <form
                      key={question.key}
                      onSubmit={advanceQuestion}
                      className="question-form"
                    >
                      <label htmlFor={question.key}>{question.label}</label>
                      <p>{question.help}</p>
                      <textarea
                        autoComplete="off"
                        id={question.key}
                        rows={5}
                        maxLength={1000}
                        value={project.brief[question.key]}
                        placeholder={question.example}
                        onChange={(e) =>
                          update({
                            ...project,
                            brief: {
                              ...project.brief,
                              [question.key]: e.target.value,
                            },
                          })
                        }
                      />
                      <div className="question-actions">
                        <button
                          type="button"
                          className="secondary"
                          onClick={previous}
                        >
                          ← 이전
                        </button>
                        <button type="submit" className="primary">
                          {project.question < 4
                            ? "다음 질문 →"
                            : "프롬프트 만들기 ✦"}
                        </button>
                      </div>
                    </form>
                    <details className="source-details" open>
                      <summary>
                        아이디어의 출발점 · 생각 {chosen.length}개
                      </summary>
                      <div className="source-chips">
                        {chosen.map((c, i) => (
                          <div key={c.id}>
                            <span>{i + 1}</span>
                            <p>{c.text}</p>
                          </div>
                        ))}
                      </div>
                    </details>
                    {project.idea && (
                      <p className="small-muted">
                        AI의 초안이에요. 답을 내 상황에 맞게 바꿔 주세요.
                      </p>
                    )}
                    {project.prompt && (
                      <p className="small-muted">
                        다시 생성하면 이전에 편집한 프롬프트를 새 결과로 바꿔요.
                      </p>
                    )}
                  </>
                ) : ready && project.step === 3 ? (
                  <>
                    <div className="prompt-summary">
                      <strong>{project.brief.title}</strong>
                      <p>
                        생각 {chosen.length}개 → 아이디어 → 핵심 기능 → 확인
                        기준
                      </p>
                    </div>
                    <label htmlFor="prompt">AI에 전달할 제작 프롬프트</label>
                    <textarea
                      id="prompt"
                      className="prompt"
                      value={project.prompt}
                      maxLength={20000}
                      rows={14}
                      onChange={(e) =>
                        update({ ...project, prompt: e.target.value })
                      }
                    />
                    <button
                      className="primary full"
                      disabled={!project.prompt.trim()}
                      onClick={() => copy(project.prompt, "제작 프롬프트")}
                    >
                      프롬프트 복사 ↗
                    </button>
                    <button className="secondary full" onClick={() => go(2)}>
                      ← 아이디어 다듬기
                    </button>
                    <div className="next-experiment">
                      <strong>만들고, 직접 확인해요.</strong>
                      <p>
                        원하는 AI에 붙여 넣어 구현한 뒤 완료 기준대로 테스트해
                        보세요. 예상과 다른 결과는 수정 요청에 구체적으로
                        적어요.
                      </p>
                      <button
                        className="primary full"
                        disabled={!canSaveIdea}
                        onClick={() => saveIdea(true)}
                      >
                        저장하고 첫 실험 만들기 →
                      </button>
                    </div>
                  </>
                ) : null}
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <p className="notice" role="status">
                  {notice}
                </p>
                {storageError && (
                  <p className="error" role="alert">
                    {storageError}
                  </p>
                )}
              </aside>
            </div>
          </>
        )}
        <footer className="studio-footer">
          <span>별이음 · ByeolIeum</span>
          <span>흩어진 생각을 이어, 나만의 그림으로.</span>
        </footer>
        <noscript>생각 카드 작성에는 JavaScript가 필요합니다.</noscript>
      </main>
    </div>
  );
}
