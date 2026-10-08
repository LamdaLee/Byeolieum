"use client";
import { useState } from "react";
import {
  canVerify,
  experimentLabels,
  experimentPrompt,
  type Experiment,
  type SavedIdea,
} from "@/lib/library";

type Props = {
  items: SavedIdea[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onResume: (item: SavedIdea) => void;
  onChange: (id: string, experiment: Experiment) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  onClose: () => void;
  onExport: () => void;
  onCopy: (text: string, label: string) => void;
  error: string;
  notice: string;
};
export default function IdeaLibrary({
  items,
  selectedId,
  onSelect,
  onResume,
  onChange,
  onDelete,
  onNew,
  onClose,
  onExport,
  onCopy,
  error,
  notice,
}: Props) {
  const [checkText, setCheckText] = useState("");
  const [validation, setValidation] = useState("");
  const item = items.find((i) => i.id === selectedId) ?? items[0];
  const e = item?.experiment;
  function change(patch: Partial<Experiment>) {
    if (!item || !e) return;
    const next = { ...e, ...patch };
    if (patch.task !== undefined && patch.task !== e.task) {
      next.checks = next.checks.map((check) => ({ ...check, done: false }));
      next.status = "planned";
    }
    if (next.status === "verified" && !canVerify(next)) next.status = "trying";
    onChange(item.id, next);
    setValidation("");
  }
  return (
    <section className="library" aria-label="아이디어 보관함">
      <div className="library-heading">
        <div>
          <p className="eyebrow">IDEAS INTO ACTION</p>
          <h2>
            아이디어 보관함 <small>{items.length}/30</small>
          </h2>
          <p>
            아이디어를 꺼내 작은 실험으로 이어 가요. 이 브라우저에만 저장돼요.
          </p>
        </div>
        <div className="library-actions">
          <button className="secondary" onClick={onClose}>
            ← 현재 작업
          </button>
          <button className="primary" onClick={onNew}>
            새 아이디어 ＋
          </button>
          <button
            className="quiet-button"
            onClick={onExport}
            disabled={!items.length}
          >
            보관함 파일 내려받기
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <p className="notice" role="status">
        {notice}
      </p>
      {!item ? (
        <div className="library-empty">
          <span>✧</span>
          <h3>아직 보관한 아이디어가 없어요.</h3>
          <p>생각을 연결해 이름을 붙인 뒤 ‘아이디어 저장’을 눌러 주세요.</p>
          <button className="primary" onClick={onClose}>
            생각 이어 가기 →
          </button>
        </div>
      ) : (
        <div className="library-layout">
          <nav className="library-list" aria-label="저장한 아이디어">
            {items.map((saved) => (
              <button
                key={saved.id}
                aria-pressed={saved.id === item.id}
                onClick={() => {
                  onSelect(saved.id);
                  setCheckText("");
                  setValidation("");
                }}
              >
                <small>{experimentLabels[saved.experiment.status]}</small>
                <strong>{saved.project.brief.title}</strong>
                <span>
                  {saved.project.brief.goal || "목표를 더 구체화해 보세요."}
                </span>
                <time dateTime={saved.updatedAt}>
                  {new Date(saved.updatedAt).toLocaleDateString("ko-KR")}
                </time>
              </button>
            ))}
          </nav>
          <article className="experiment-panel" key={item.id}>
            <div className="experiment-heading">
              <div>
                <p className="eyebrow">YOUR FIRST EXPERIMENT</p>
                <h3>{item.project.brief.title}</h3>
                <p>{item.project.brief.goal}</p>
              </div>
              <span className={`experiment-status status-${e!.status}`}>
                {experimentLabels[e!.status]}
              </span>
            </div>
            <details className="source-details">
              <summary>
                아이디어의 출발점 · 생각 {item.project.selected.length}개
              </summary>
              <div className="source-chips">
                {item.project.cards
                  .filter((c) => item.project.selected.includes(c.id))
                  .map((c, i) => (
                    <div key={c.id}>
                      <span>{i + 1}</span>
                      <p>{c.text}</p>
                    </div>
                  ))}
              </div>
            </details>
            <div className="library-actions">
              <button className="secondary" onClick={() => onResume(item)}>
                아이디어 이어서 다듬기
              </button>
              <button
                className="secondary"
                disabled={!item.project.prompt.trim()}
                onClick={() =>
                  onCopy(item.project.prompt, "저장한 제작 프롬프트")
                }
              >
                제작 프롬프트 복사
              </button>
            </div>
            {e!.basis.feature !== item.project.brief.feature ||
            e!.basis.check !== item.project.brief.check ? (
              <p className="experiment-help">
                아이디어의 기능이나 확인 기준이 바뀌었어요. 이전 실험 기록을
                보존했으니 아래 계획도 새 아이디어에 맞는지 확인해 주세요.
              </p>
            ) : null}
            <section className="experiment-block">
              <p className="eyebrow">01 · PLAN</p>
              <h4>오늘 해 볼 작은 과제</h4>
              <p className="small-muted">
                한 번에 기능 하나만. 아래 초안을 내 상황에 맞게 바꿔 주세요.
              </p>
              <label htmlFor="experiment-task">첫 실험 과제</label>
              <textarea
                id="experiment-task"
                rows={3}
                maxLength={1500}
                value={e!.task}
                onChange={(event) => change({ task: event.target.value })}
              />
            </section>
            <section className="experiment-block">
              <p className="eyebrow">02 · CHECK</p>
              <h4>직접 확인할 기준</h4>
              <p className="small-muted">
                AI가 성공했다고 말해도 직접 실행해 본 뒤 체크해요.
              </p>
              <div className="experiment-checks">
                {e!.checks.map((c) => (
                  <div key={c.id}>
                    <label>
                      <input
                        type="checkbox"
                        checked={c.done}
                        onChange={(event) =>
                          change({
                            checks: e!.checks.map((x) =>
                              x.id === c.id
                                ? { ...x, done: event.target.checked }
                                : x,
                            ),
                          })
                        }
                      />
                      <span>{c.text}</span>
                    </label>
                    <button
                      className="quiet-button"
                      aria-label={`확인 기준 삭제: ${c.text}`}
                      onClick={() =>
                        change({
                          checks: e!.checks.filter((x) => x.id !== c.id),
                        })
                      }
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
              <form
                className="check-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!checkText.trim()) {
                    setValidation(
                      "직접 해 볼 행동과 기대하는 결과를 적어 주세요.",
                    );
                    return;
                  }
                  change({
                    checks: [
                      ...e!.checks,
                      {
                        id: crypto.randomUUID(),
                        text: checkText.trim(),
                        done: false,
                      },
                    ],
                  });
                  setCheckText("");
                }}
              >
                <label htmlFor="new-check">확인 기준 추가</label>
                <div>
                  <input
                    id="new-check"
                    value={checkText}
                    onChange={(event) => setCheckText(event.target.value)}
                    maxLength={500}
                    placeholder="예: 항목 추가 후 새로고침해도 남아 있다"
                    disabled={e!.checks.length >= 10}
                  />
                  <button
                    className="secondary"
                    type="submit"
                    disabled={e!.checks.length >= 10}
                  >
                    추가
                  </button>
                </div>
                <small>최대 10개 · 실제로 확인한 항목만 체크해 주세요.</small>
              </form>
            </section>
            <section className="experiment-block">
              <p className="eyebrow">03 · REFLECT</p>
              <h4>실제로 해 보니 어땠나요?</h4>
              {(
                [
                  {
                    key: "observed",
                    label: "실제 결과",
                    placeholder:
                      "무엇을 실행했고, 예상과 실제 결과는 어떻게 달랐나요?",
                  },
                  {
                    key: "blocker",
                    label: "막힌 점",
                    placeholder: "오류 메시지나 진행하기 어려웠던 부분",
                  },
                  {
                    key: "learned",
                    label: "배운 점",
                    placeholder: "새롭게 이해한 개념이나 발견한 점",
                  },
                  {
                    key: "next",
                    label: "다음에 바꿀 점",
                    placeholder: "다음 실험에서 고칠 작은 부분 하나",
                  },
                ] as const
              ).map((field) => (
                <div className="experiment-field" key={field.key}>
                  <label htmlFor={`experiment-${field.key}`}>
                    {field.label}
                  </label>
                  <textarea
                    id={`experiment-${field.key}`}
                    value={e![field.key]}
                    rows={2}
                    maxLength={1500}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      change({ [field.key]: event.target.value })
                    }
                  />
                </div>
              ))}
              <label htmlFor="experiment-status">실험 상태</label>
              <select
                id="experiment-status"
                value={e!.status}
                onChange={(event) => {
                  const status = event.target.value as Experiment["status"];
                  if (status === "verified" && !canVerify(e!)) {
                    setValidation(
                      "과제를 적고 모든 확인 기준을 직접 체크한 뒤 실제 결과를 기록해야 완료로 표시할 수 있어요.",
                    );
                    return;
                  }
                  change({ status });
                }}
              >
                {Object.entries(experimentLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              {validation && (
                <p className="error" role="alert">
                  {validation}
                </p>
              )}
              <p className="small-muted">
                체크와 기록은 자동 저장돼요. ‘확인 완료’는 본인이 실행한 결과를
                기준으로 표시해요.
              </p>
            </section>
            <div className="experiment-help">
              <strong>막혔다면, 기록을 가지고 AI와 다시 풀어 봐요.</strong>
              <p>
                실험 과제와 확인 기준, 실제 결과를 담은 프롬프트를 복사해 원하는
                AI에 전달할 수 있어요. 이 버튼은 API를 호출하지 않아요.
              </p>
              <button
                className="primary"
                onClick={() =>
                  onCopy(experimentPrompt(item), "실험 도움 프롬프트")
                }
              >
                실험 도움 프롬프트 복사 ↗
              </button>
            </div>
            <button className="danger-button" onClick={() => onDelete(item.id)}>
              이 아이디어 보관함에서 삭제
            </button>
          </article>
        </div>
      )}
    </section>
  );
}
