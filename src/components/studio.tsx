"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  buildPrompt,
  emptyProject,
  parseProject,
  sampleProject,
  type Brief,
  type Project,
} from "@/lib/project";
import { Mark } from "./mark";
const KEY = "byeolieum-project-v1";
const stages = [
  "생각 모으기",
  "생각 연결하기",
  "만들 것 정하기",
  "프롬프트 완성",
];
const questions: { key: keyof Brief; label: string; hint: string }[] = [
  { key: "title", label: "아이디어 이름", hint: "예: 교육 준비 체크리스트" },
  {
    key: "audience",
    label: "누가 사용할까요?",
    hint: "예: 교육을 준비하는 담당자",
  },
  {
    key: "goal",
    label: "어떤 불편을 줄이고 싶나요?",
    hint: "예: 준비 항목을 빠뜨리지 않고 확인하기",
  },
  {
    key: "feature",
    label: "첫 버전의 핵심 기능은?",
    hint: "예: 항목 추가·삭제·완료 표시",
  },
  {
    key: "check",
    label: "잘 작동하는지 어떻게 확인할까요?",
    hint: "예: 빈 항목 추가 방지, 새로고침 후 목록 유지",
  },
];
export default function Studio() {
  const [project, setProject] = useState<Project>(emptyProject);
  const [ready, setReady] = useState(false);
  const [note, setNote] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
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
          "브라우저 저장을 사용할 수 없어요. 작업을 마치기 전에 프롬프트를 복사해 주세요.",
        );
      }
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(project));
    } catch {
      const frame = requestAnimationFrame(() =>
        setStorageError("저장에 실패했어요. 프롬프트를 복사해 보관해 주세요."),
      );
      return () => cancelAnimationFrame(frame);
    }
  }, [project, ready]);
  const chosen = project.cards.filter((c) => project.selected.includes(c.id));
  function update(next: Project) {
    setProject(next);
    setNotice("");
    setError("");
  }
  function revealStage() {
    requestAnimationFrame(() => {
      const title = heading.current;
      if (!title) return;
      title.focus({ preventScroll: true });
      const panel = title.closest(".work-panel");
      if (!panel) return;
      const top = panel.getBoundingClientRect().top + window.scrollY - 20;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
    });
  }
  function go(step: number) {
    update({ ...project, step });
    revealStage();
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
  }
  function toggle(id: string) {
    if (!project.selected.includes(id) && project.selected.length >= 5) {
      setError("한 번에 5개까지 연결할 수 있어요.");
      return;
    }
    update({
      ...project,
      selected: project.selected.includes(id)
        ? project.selected.filter((x) => x !== id)
        : [...project.selected, id],
    });
  }
  function next() {
    if (project.step === 0) {
      if (project.cards.length < 2) {
        setError("서로 연결할 생각 카드를 2개 이상 만들어 주세요.");
        return;
      }
      go(1);
    } else if (project.step === 1) {
      if (chosen.length < 2) {
        setError("연결할 카드를 2개 이상 선택해 주세요.");
        return;
      }
      go(2);
    }
  }
  function generate(e: React.FormEvent) {
    e.preventDefault();
    if (questions.some((q) => !project.brief[q.key].trim())) {
      setError("각 질문에 답을 적어 주세요.");
      return;
    }
    update({ ...project, step: 3, prompt: buildPrompt(project) });
    revealStage();
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(project.prompt);
      setNotice("프롬프트를 복사했어요. 원하는 AI에 붙여 넣어 보세요.");
    } catch {
      setError("복사하지 못했어요. 아래 프롬프트를 직접 선택해 복사해 주세요.");
    }
  }
  function reset() {
    if (!window.confirm("이 브라우저에 저장한 카드와 작업을 모두 지울까요?"))
      return;
    update(emptyProject);
    setNote("");
    setEditId(null);
    try {
      localStorage.removeItem(KEY);
    } catch {
      setStorageError(
        "브라우저 저장소에 접근할 수 없어 저장 기록 삭제를 확인할 수 없어요.",
      );
    }
    setNotice("작업을 초기화했어요.");
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace">
        작업 영역으로 이동
      </a>
      <aside className="sidebar">
        <Link className="brand" href="/" aria-label="별이음 홈">
          <Mark />
          <span>
            별이음<small>ByeolIeum</small>
          </span>
        </Link>
        <div className="sidebar-title">MY LITTLE CONSTELLATION</div>
        <div className="nav-active">
          <span>✦</span> 아이디어 작업실
        </div>
        <div className="sidebar-note">
          <Mark />
          <p>
            작은 생각 하나가
            <br />
            새로운 시작이 될 수 있어요.
          </p>
        </div>
        <button className="reset" onClick={reset} disabled={!ready}>
          저장한 작업 초기화
        </button>
        <small className="local-note">
          이 브라우저에만 저장돼요.
          <br />
          계정·AI API 연결은 없어요.
        </small>
      </aside>
      <main id="workspace">
        <header className="topbar">
          <span>생각을 잇는 나만의 공간</span>
          <span className="badge">PROTOTYPE v0.1</span>
        </header>
        <section className="intro">
          <div>
            <div className="eyebrow">COLLECT · CONNECT · CREATE</div>
            <h1>
              흩어진 생각을 이어,
              <br />
              <span>나만의 그림으로.</span>
            </h1>
            <p>
              생각 카드를 조합하고, AI와 시작할 제작 프롬프트를 만들어 보세요.
            </p>
          </div>
          <div className="hero-mark">
            <Mark />
          </div>
        </section>
        <ol className="steps" aria-label="제작 단계">
          {stages.map((stage, i) => (
            <li
              key={stage}
              className={
                project.step === i ? "current" : project.step > i ? "done" : ""
              }
              aria-current={project.step === i ? "step" : undefined}
            >
              <span>{project.step > i ? "✓" : `0${i + 1}`}</span>
              {stage}
            </li>
          ))}
        </ol>
        <div className="workspace-grid">
          <section className="work-panel" aria-busy={!ready}>
            <div className="section-top">
              <div>
                <p className="eyebrow">STEP 0{project.step + 1}</p>
                <h2 ref={heading} tabIndex={-1}>
                  {stages[project.step]}
                </h2>
              </div>
              {project.step === 0 && (
                <button
                  className="secondary"
                  disabled={!ready}
                  onClick={() => {
                    if (
                      project.cards.length &&
                      !window.confirm("현재 작업을 예제로 바꿀까요?")
                    )
                      return;
                    update(structuredClone(sampleProject));
                    setNote("");
                    setEditId(null);
                  }}
                >
                  예제로 체험하기 ↗
                </button>
              )}
            </div>
            {!ready ? (
              <p>저장한 생각을 불러오고 있어요…</p>
            ) : (
              <>
                {project.step === 0 && (
                  <>
                    <p className="description">
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
                        onChange={(e) => setNote(e.target.value)}
                        placeholder="예: 교육 준비물을 자주 빠뜨려요."
                        rows={3}
                      />
                      <div className="form-bottom">
                        <small>{note.length}/500</small>
                        <div>
                          {editId && (
                            <button
                              type="button"
                              className="text-button"
                              onClick={() => {
                                setEditId(null);
                                setNote("");
                              }}
                            >
                              취소
                            </button>
                          )}
                          <button className="primary" type="submit">
                            {editId ? "수정 저장" : "＋ 카드 추가"}
                          </button>
                        </div>
                      </div>
                    </form>
                    <div className="cards">
                      {project.cards.map((c, i) => (
                        <article className="thought-card" key={c.id}>
                          <small>
                            THOUGHT {String(i + 1).padStart(2, "0")}
                          </small>
                          <p>{c.text}</p>
                          <div className="card-actions">
                            <button
                              onClick={() => {
                                setNote(c.text);
                                setEditId(c.id);
                                document.getElementById("note")?.focus();
                              }}
                            >
                              수정
                            </button>
                            <button
                              aria-label={`카드 ${i + 1} 삭제`}
                              onClick={() => {
                                update({
                                  ...project,
                                  cards: project.cards.filter(
                                    (x) => x.id !== c.id,
                                  ),
                                  selected: project.selected.filter(
                                    (x) => x !== c.id,
                                  ),
                                });
                                if (editId === c.id) {
                                  setEditId(null);
                                  setNote("");
                                }
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                    {!project.cards.length && (
                      <div className="empty">
                        <span>✧</span>
                        <p>첫 번째 별을 남겨 보세요.</p>
                        <small>막막하면 ‘예제로 체험하기’를 눌러 보세요.</small>
                      </div>
                    )}
                  </>
                )}
                {project.step === 1 && (
                  <>
                    <p className="description">
                      함께 놓아 보고 싶은 카드를 2~5개 골라 주세요. 정답은
                      없어요.
                    </p>
                    <div className="cards">
                      {project.cards.map((c, i) => (
                        <button
                          key={c.id}
                          className={`thought-card selectable ${project.selected.includes(c.id) ? "selected" : ""}`}
                          aria-pressed={project.selected.includes(c.id)}
                          onClick={() => toggle(c.id)}
                        >
                          <small>
                            THOUGHT {String(i + 1).padStart(2, "0")}{" "}
                            <span>
                              {project.selected.includes(c.id) ? "✓" : "＋"}
                            </span>
                          </small>
                          <p>{c.text}</p>
                        </button>
                      ))}
                    </div>
                    <p className="selection-count">
                      {chosen.length}/5개 선택 · 다음에는 이 생각들을 하나의
                      아이디어로 정리해요.
                    </p>
                  </>
                )}
                {project.step === 2 && (
                  <>
                    <p className="description">
                      고른 생각이 곧 완성된 기획일 필요는 없어요. 아래 순서로
                      무엇을 만들지 조금씩 정해 볼까요?
                    </p>
                    <div className="idea-bridge">
                      <strong>방금 연결한 생각 {chosen.length}개</strong>
                      <ul>
                        {chosen.map((card) => (
                          <li key={card.id}>{card.text}</li>
                        ))}
                      </ul>
                      <p>
                        이 생각들의 공통점이나 함께 해결하고 싶은 일을 떠올려
                        보세요. 그 내용을 아래 ‘아이디어의 목적’에 적으면 돼요.
                      </p>
                    </div>
                    {project.prompt && (
                      <p className="description">
                        다시 생성하면 이전에 직접 수정한 프롬프트가 새 결과로
                        바뀌어요.
                      </p>
                    )}
                    <form
                      id="brief-form"
                      onSubmit={generate}
                      className="brief-form"
                    >
                      {[
                        {
                          title: "1. 생각을 아이디어로",
                          description:
                            "무엇을 만들고 싶은지 이름과 목적부터 정해요.",
                          keys: ["title", "goal"],
                        },
                        {
                          title: "2. 작은 기능 하나로",
                          description:
                            "누가 쓸지 정하고, 그 사람에게 꼭 필요한 기능만 골라요.",
                          keys: ["audience", "feature"],
                        },
                        {
                          title: "3. 직접 확인할 방법으로",
                          description:
                            "사용자가 해 볼 행동과 기대하는 결과를 적어요. 이 답이 AI 결과를 검증하는 기준이 돼요.",
                          keys: ["check"],
                        },
                      ].map((group) => (
                        <fieldset className="question-group" key={group.title}>
                          <legend>{group.title}</legend>
                          <p className="description">{group.description}</p>
                          {group.keys.map((key) => {
                            const q = questions.find(
                              (question) => question.key === key,
                            )!;
                            return (
                              <div key={q.key}>
                                <label htmlFor={q.key}>
                                  {q.key === "goal"
                                    ? "아이디어의 목적"
                                    : q.label}
                                </label>
                                {q.key === "goal" && (
                                  <p className="field-hint">
                                    어떤 불편을 줄이거나, 어떤 일을 해 보고
                                    싶나요?
                                  </p>
                                )}
                                <textarea
                                  id={q.key}
                                  rows={q.key === "check" ? 3 : 2}
                                  required
                                  maxLength={1000}
                                  value={project.brief[q.key]}
                                  placeholder={q.hint}
                                  onChange={(e) =>
                                    update({
                                      ...project,
                                      brief: {
                                        ...project.brief,
                                        [q.key]: e.target.value,
                                      },
                                    })
                                  }
                                />
                              </div>
                            );
                          })}
                        </fieldset>
                      ))}
                    </form>
                    <div className="flow-summary">
                      <strong>다음 단계에서는</strong>
                      <p>
                        지금 정한 아이디어와 조건을 AI에 전달할 문장으로 바꿔요.
                        생성 후에도 직접 읽고 수정할 수 있어요.
                      </p>
                    </div>
                  </>
                )}
                {project.step === 3 && (
                  <>
                    <p className="description">
                      생각과 조건이 잘 담겼는지 읽어 보고, 자유롭게 수정하세요.
                    </p>
                    <div className="flow-summary">
                      <strong>{project.brief.title}</strong>
                      <p>
                        생각 {chosen.length}개 → 아이디어의 목적 → 핵심 기능 →
                        확인 기준을 아래 프롬프트에 담았어요.
                      </p>
                    </div>
                    <label htmlFor="prompt">AI에 전달할 제작 프롬프트</label>
                    <textarea
                      id="prompt"
                      className="prompt"
                      value={project.prompt}
                      maxLength={20000}
                      onChange={(e) =>
                        update({ ...project, prompt: e.target.value })
                      }
                      rows={18}
                    />
                    <div className="next-experiment">
                      <strong>다음은 직접 확인할 차례예요.</strong>
                      <p>
                        원하는 AI에 붙여 넣고 만들어 보세요. 완료 기준대로
                        작동하는지 확인하고, 예상과 다른 부분을 구체적으로 알려
                        주세요.
                      </p>
                      <small>
                        외부 AI에 전달하기 전 이름·연락처 등 개인정보를
                        확인하세요.
                      </small>
                    </div>
                  </>
                )}
              </>
            )}
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
            <div className="footer-actions">
              {project.step > 0 ? (
                <button
                  className="secondary"
                  onClick={() => go(project.step - 1)}
                >
                  ← 이전 단계
                </button>
              ) : (
                <small>카드 2개 이상으로 시작해요.</small>
              )}
              {project.step < 2 ? (
                <button
                  key="next"
                  type="button"
                  className="primary"
                  disabled={!ready}
                  onClick={next}
                >
                  다음 단계 →
                </button>
              ) : project.step === 2 ? (
                <button
                  key="generate"
                  form="brief-form"
                  type="submit"
                  className="primary"
                >
                  프롬프트 만들기 ✦
                </button>
              ) : (
                <button
                  className="primary"
                  key="copy"
                  type="button"
                  disabled={!project.prompt.trim()}
                  onClick={copy}
                >
                  프롬프트 복사 ↗
                </button>
              )}
            </div>
          </section>
          <aside className="preview">
            <div className="eyebrow">YOUR CONSTELLATION</div>
            <h2>생각이 이어지는 곳</h2>
            <svg
              viewBox="0 0 300 250"
              role="img"
              aria-label={`선택한 생각 ${chosen.length}개가 아이디어로 이어지는 그림`}
            >
              <path d="M25 220Q100 15 280 65" fill="none" stroke="#e8e3f5" />
              <circle
                cx="150"
                cy="130"
                r="76"
                fill="none"
                stroke="#e8e3f5"
                strokeDasharray="3 8"
              />
              {chosen.map((c, i) => {
                const a =
                  (i / Math.max(chosen.length, 1)) * Math.PI * 2 - Math.PI / 2;
                const x = 150 + 94 * Math.cos(a),
                  y = 125 + 90 * Math.sin(a);
                return (
                  <g key={c.id}>
                    <line
                      x1={x}
                      y1={y}
                      x2="150"
                      y2="130"
                      stroke="#9280ce"
                      strokeWidth="2"
                    />
                    <circle
                      cx={x}
                      cy={y}
                      r="8"
                      fill={i % 2 ? "#4778c7" : "#6654c0"}
                    />
                    <text
                      x={x}
                      y={y - 15}
                      textAnchor="middle"
                      fontSize="12"
                      fill="#625b7d"
                    >
                      {i + 1}
                    </text>
                  </g>
                );
              })}
              <path
                d="m150 111 5 14 14 5-14 5-5 14-5-14-14-5 14-5z"
                fill="#6654c0"
              />
            </svg>
            <h3>{project.brief.title || "아직 이름 없는 가능성"}</h3>
            <p>
              {chosen.length
                ? "이 생각들이 아이디어의 출발점이에요."
                : "카드를 선택하면 나만의 별자리가 나타나요."}
            </p>
            <ol className="source-list">
              {chosen.map((c) => (
                <li key={c.id}>{c.text}</li>
              ))}
            </ol>
            <div className="tip">
              <strong>작게 시작해도 충분해요.</strong>
              <p>
                멋진 아이디어보다, 내가 실제로 써 보고 싶은 기능 하나를 찾아
                보세요.
              </p>
            </div>
          </aside>
        </div>
        <footer className="page-footer">
          별이음 · ByeolIeum <span>생각의 연결은 당신이, 첫걸음은 함께.</span>
        </footer>
        <noscript>
          별이음의 카드 작성과 프롬프트 생성에는 JavaScript가 필요합니다.
        </noscript>
      </main>
    </div>
  );
}
