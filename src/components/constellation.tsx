"use client";
import { memo, useEffect, useRef } from "react";
import { type Card, type Position } from "@/lib/project";
const spots: Position[] = [
  { x: 19, y: 22 },
  { x: 19, y: 69 },
  { x: 80, y: 23 },
  { x: 80, y: 70 },
  { x: 50, y: 15 },
  { x: 50, y: 78 },
];
function position(
  index: number,
  id: string,
  positions: Record<string, Position>,
) {
  return positions[id] ?? spots[index % spots.length];
}
function wire(pos: Position) {
  const x = pos.x * 10,
    y = pos.y * 6.2;
  return `M ${x} ${y} C ${(x + 500) / 2} ${y}, ${(x + 500) / 2} 322, 500 322`;
}
type Props = {
  locked: boolean;
  cards: Card[];
  selected: string[];
  positions: Record<string, Position>;
  title: string;
  goal: string;
  onToggle: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, position: Position) => void;
  onArrange: () => void;
  onAdd: () => void;
  onConnect: () => void;
};
export default memo(function Constellation({
  locked,
  cards,
  selected,
  positions,
  title,
  goal,
  onToggle,
  onEdit,
  onDelete,
  onMove,
  onArrange,
  onAdd,
  onConnect,
}: Props) {
  const board = useRef<HTMLDivElement>(null);
  const nodes = useRef(new Map<string, HTMLElement>());
  const paths = useRef(new Map<string, SVGPathElement>());
  const drag = useRef<{
    id: string;
    pointer: number;
    startX: number;
    startY: number;
    original: Position;
    current: Position;
    frame: number | null;
    width: number;
    height: number;
    marginX: number;
    marginY: number;
  } | null>(null);
  useEffect(
    () => () => {
      if (drag.current?.frame != null) cancelAnimationFrame(drag.current.frame);
    },
    [],
  );
  function clamp(id: string, pos: Position): Position {
    const el = nodes.current.get(id),
      root = board.current;
    if (!el || !root) return pos;
    const marginX = ((el.offsetWidth / 2 + 10) / root.clientWidth) * 100;
    const marginY = ((el.offsetHeight / 2 + 8) / root.clientHeight) * 100;
    return {
      x: Math.min(100 - marginX, Math.max(marginX, pos.x)),
      y: Math.min(100 - marginY, Math.max(marginY, pos.y)),
    };
  }
  function paint(id: string, pos: Position) {
    const el = nodes.current.get(id);
    if (el) {
      el.style.left = `${pos.x}%`;
      el.style.top = `${pos.y}%`;
    }
    paths.current.get(id)?.setAttribute("d", wire(pos));
  }
  function start(
    e: React.PointerEvent<HTMLButtonElement>,
    id: string,
    index: number,
  ) {
    if (e.button !== 0 || drag.current) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const root = board.current,
      node = nodes.current.get(id);
    if (!root || !node) return;
    const width = root.clientWidth,
      height = root.clientHeight;
    const original = position(index, id, positions);
    drag.current = {
      id,
      pointer: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      original,
      current: original,
      frame: null,
      width,
      height,
      marginX: ((node.offsetWidth / 2 + 10) / width) * 100,
      marginY: ((node.offsetHeight / 2 + 8) / height) * 100,
    };
    nodes.current.get(id)?.classList.add("dragging");
  }
  function move(e: React.PointerEvent<HTMLButtonElement>) {
    const d = drag.current,
      root = board.current;
    if (!d || d.pointer !== e.pointerId || !root) return;
    // Geometry is sampled once on pointerdown: no layout reads per frame.
    d.current = {
      x: Math.min(
        100 - d.marginX,
        Math.max(
          d.marginX,
          d.original.x + ((e.clientX - d.startX) / d.width) * 100,
        ),
      ),
      y: Math.min(
        100 - d.marginY,
        Math.max(
          d.marginY,
          d.original.y + ((e.clientY - d.startY) / d.height) * 100,
        ),
      ),
    };
    if (d.frame !== null) return;
    d.frame = requestAnimationFrame(() => {
      paint(d.id, d.current);
      d.frame = null;
    });
  }
  function end(e: React.PointerEvent<HTMLButtonElement>, cancel = false) {
    const d = drag.current;
    if (!d || d.pointer !== e.pointerId) return;
    if (d.frame !== null) cancelAnimationFrame(d.frame);
    paint(d.id, cancel ? d.original : d.current);
    nodes.current.get(d.id)?.classList.remove("dragging");
    drag.current = null;
    if (!cancel) onMove(d.id, d.current);
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
  }
  function keyboard(
    e: React.KeyboardEvent<HTMLButtonElement>,
    id: string,
    index: number,
  ) {
    const offsets: Record<string, Position> = {
      ArrowLeft: { x: -3, y: 0 },
      ArrowRight: { x: 3, y: 0 },
      ArrowUp: { x: 0, y: -3 },
      ArrowDown: { x: 0, y: 3 },
    };
    const offset = offsets[e.key];
    if (!offset) return;
    e.preventDefault();
    const old = position(index, id, positions);
    onMove(id, clamp(id, { x: old.x + offset.x, y: old.y + offset.y }));
  }
  return (
    <div className="canvas" ref={board} aria-label="생각 별자리 캔버스">
      <svg
        className="connections"
        viewBox="0 0 1000 620"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {cards.map((card, index) =>
          selected.includes(card.id) ? (
            <path
              key={card.id}
              ref={(el) => {
                if (el) paths.current.set(card.id, el);
                else paths.current.delete(card.id);
              }}
              d={wire(position(index, card.id, positions))}
              className="connection"
            />
          ) : null,
        )}
      </svg>
      <div
        className={`idea-node ${selected.length >= 2 ? "connected" : ""}`}
        aria-live="polite"
      >
        <span className="idea-star">✦</span>
        <strong>
          {title ||
            (selected.length >= 2
              ? "어떤 가능성이 보이나요?"
              : "생각을 이어 보세요")}
        </strong>
        <p>
          {goal ||
            (selected.length >= 2
              ? `생각 ${selected.length}개에서 아이디어를 찾아볼 차례예요.`
              : "함께 놓아 보고 싶은 카드를 골라 주세요.")}
        </p>
        {selected.length >= 2 && <small>생각 {selected.length}개 연결</small>}
      </div>
      <div className="canvas-cards">
        {cards.map((card, index) => {
          const pos = position(index, card.id, positions),
            active = selected.includes(card.id);
          return (
            <article
              key={card.id}
              className={`canvas-card tone-${index % 3} ${active ? "selected" : ""}`}
              ref={(el) => {
                if (el) nodes.current.set(card.id, el);
                else nodes.current.delete(card.id);
              }}
              style={{ left: `${pos.x}%`, top: `${pos.y}%` }}
            >
              <div className="card-top">
                <button
                  type="button"
                  className="card-grip"
                  aria-label={`카드 ${index + 1} 이동`}
                  title="드래그하거나 방향키로 이동"
                  onPointerDown={(e) => start(e, card.id, index)}
                  onPointerMove={move}
                  onPointerUp={(e) => end(e)}
                  onPointerCancel={(e) => end(e, true)}
                  onKeyDown={(e) => keyboard(e, card.id, index)}
                >
                  ⠿
                </button>
                <span>THOUGHT {String(index + 1).padStart(2, "0")}</span>
                <button
                  className="card-edit"
                  onClick={() => onEdit(card.id)}
                  aria-label={`카드 ${index + 1} 수정`}
                >
                  <span className="card-edit-dots" aria-hidden="true">···</span>
                  <span className="card-edit-label" aria-hidden="true">수정</span>
                </button>
              </div>
              <p>{card.text}</p>
              <button
                type="button"
                className="card-select"
                disabled={locked}
                aria-pressed={active}
                aria-label={`${active ? "선택 해제" : "생각 선택"}: ${card.text}`}
                onClick={() => onToggle(card.id)}
              >
                <span>{active ? "✓" : "＋"}</span>
                {active ? "연결한 생각" : "이 생각 연결하기"}
              </button>
              <button
                type="button"
                className="card-delete"
                onClick={() => onDelete(card.id)}
                aria-label={`카드 ${index + 1} 삭제`}
              >
                삭제
              </button>
              <span className="connection-port" aria-hidden="true" />
            </article>
          );
        })}
      </div>
      {!cards.length && (
        <div className="canvas-empty">
          <span>✧</span>
          <strong>작은 생각 하나부터.</strong>
          <p>
            오른쪽에서 첫 생각을 남기거나
            <br />
            예제로 체험해 보세요.
          </p>
        </div>
      )}
      <div className="canvas-toolbar">
        <button onClick={onAdd}>
          ＋ <span>생각 추가</span>
        </button>
        <button onClick={onConnect}>
          ⌁ <span>선택 연결</span>
          <small>{selected.length}</small>
        </button>
        <button onClick={onArrange}>
          ▧ <span>자리 정리</span>
        </button>
      </div>
    </div>
  );
});
