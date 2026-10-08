"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, getLoginProviders } from "@/lib/supabase-browser";
import {
  mergeIntoCloud,
  parseCloudDocument,
  type CloudDocument,
} from "@/lib/cloud";

type Props = {
  document: CloudDocument;
  mode: string | null;
  open: boolean;
  ready: boolean;
  importAllowed: boolean;
  onOpen: () => void;
  onClose: () => void;
  onActivate: (document: CloudDocument, userId: string) => boolean;
  onGuest: () => void;
};
export default function AccountPanel({
  document,
  mode,
  open,
  ready,
  importAllowed,
  onOpen,
  onClose,
  onActivate,
  onGuest,
}: Props) {
  const [client] = useState(getSupabase);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [providers, setProviders] = useState<{
    google: boolean;
    kakao: boolean;
    naver: boolean;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cloud, setCloud] = useState<CloudDocument | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saveStopped, setSaveStopped] = useState(false);
  const [sync, setSync] = useState("계정 기록 연결 전");
  const [lastSaved, setLastSaved] = useState("");
  const [tick, setTick] = useState(0);
  const revision = useRef<number | null>(null);
  const userId = user?.id;
  const saved = useRef("");
  const writing = useRef(false);
  const generation = useRef(0);
  const invalidate = useCallback(() => {
    generation.current++;
  }, []);
  const serialized = useMemo(() => JSON.stringify(document), [document]);
  const latest = useRef(serialized);
  useEffect(() => {
    latest.current = serialized;
  }, [serialized]);
  useEffect(() => {
    if (!client) return;
    let alive = true;
    client.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      setUser(data.session?.user ?? null);
      setAuthReady(true);
      if (error)
        setError("로그인을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.");
    });
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      if (alive) {
        setUser(session?.user ?? null);
        setAuthReady(true);
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [client]);
  const socialExchange = useRef(false);
  useEffect(() => {
    if (!client || socialExchange.current) return;
    const params = new URLSearchParams(window.location.search);
    if (
      !params.has("kakao_login") &&
      !params.has("naver_login") &&
      !params.has("login_error")
    )
      return;
    socialExchange.current = true;
    const provider =
      params.has("kakao_login") || params.get("login_error") === "kakao"
        ? "kakao"
        : "naver";
    const label = provider === "kakao" ? "카카오" : "네이버";
    const success = params.get(`${provider}_login`) === "ready";
    params.delete("kakao_login");
    params.delete("naver_login");
    params.delete("login_error");
    window.history.replaceState(
      null,
      "",
      window.location.pathname +
        (params.size ? `?${params}` : "") +
        window.location.hash,
    );
    if (!success) {
      queueMicrotask(() =>
        setError(
          `${label} 로그인을 완료하지 못했어요. 설정을 확인한 뒤 다시 시도해 주세요.`,
        ),
      );
      return;
    }
    queueMicrotask(() => setBusy(true));
    void (async () => {
      try {
        const response = await fetch(`/api/auth/${provider}/session`, {
          method: "POST",
          credentials: "same-origin",
        });
        if (!response.ok) throw new Error("Expired login");
        const tokens = await response.json();
        const { error } = await client.auth.setSession(tokens);
        if (error) throw error;
      } catch {
        setError(`${label} 로그인 연결이 만료됐어요. 다시 로그인해 주세요.`);
      } finally {
        setBusy(false);
      }
    })();
  }, [client]);
  useEffect(() => {
    if (!authReady || !mode || mode === userId) return;
    const frame = requestAnimationFrame(() => {
      invalidate();
      onGuest();
      setMessage("로그인 상태가 바뀌어 가입 전 브라우저 작업으로 돌아왔어요.");
    });
    return () => cancelAnimationFrame(frame);
  }, [authReady, mode, userId, onGuest, invalidate]);
  useEffect(() => {
    if (!client || !open) return;
    const control = new AbortController();
    getLoginProviders(control.signal)
      .then(setProviders)
      .catch(() => {
        if (!control.signal.aborted)
          setError(
            "로그인 서비스를 확인하지 못했어요. 잠시 후 다시 열어 주세요.",
          );
      });
    return () => control.abort();
  }, [client, open]);
  const load = useCallback(async () => {
    if (!client || !userId) return;
    const current = ++generation.current;
    setBusy(true);
    setLoaded(false);
    setError("");
    const { data, error } = await client
      .from("idea_spaces")
      .select("document,revision")
      .eq("user_id", userId)
      .maybeSingle();
    if (current !== generation.current) return;
    setBusy(false);
    if (error) {
      setError(
        "계정 기록을 불러오지 못했어요. 잠시 후 다시 연결해 주세요. 현재 작업은 유지돼요.",
      );
      return;
    }
    const parsed = data ? parseCloudDocument(data.document) : null;
    if (
      data &&
      (!parsed || !Number.isInteger(data.revision) || data.revision < 1)
    ) {
      setError(
        "계정 기록을 읽지 못했어요. 기존 클라우드 기록을 덮어쓰지 않았어요.",
      );
      return;
    }
    revision.current = data?.revision ?? 0;
    saved.current = parsed ? JSON.stringify(parsed) : "";
    setLastSaved(saved.current);
    setCloud(parsed);
    setLoaded(true);
    setConflict(false);
    setSaveStopped(false);
    setSync(
      parsed ? "계정 기록을 불러올 수 있어요" : "첫 계정 저장을 준비했어요",
    );
  }, [client, userId]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      revision.current = null;
      setCloud(null);
      setLoaded(false);
      setConflict(false);
      if (userId) void load();
    });
    return () => {
      cancelAnimationFrame(frame);
      invalidate();
    };
  }, [userId, load, invalidate]);
  const persist = useCallback(
    async (value: CloudDocument) => {
      if (!client || !userId || revision.current === null || writing.current)
        return false;
      const current = generation.current;
      const expected = revision.current;
      writing.current = true;
      setSaving(true);
      setSync("클라우드에 저장 중…");
      setError("");
      setSaveStopped(false);
      try {
        const { data, error } = await client.rpc("save_idea_space", {
          p_expected_revision: expected,
          p_document: value,
        });
        if (current !== generation.current) return false;
        if (error) {
          setSaveStopped(true);
          if (error.code === "40001") {
            setConflict(true);
            setError(
              "다른 기기에서 기록이 바뀌었어요. 현재 기록을 파일로 보관한 뒤 최신 계정 기록을 불러와 주세요.",
            );
          } else
            setError(
              "클라우드에 저장하지 못했어요. 현재 기록은 화면에 남아 있어요. 다시 저장하거나 파일로 내려받아 주세요.",
            );
          setSync("아직 저장되지 않은 변경이 있어요");
          return false;
        }
        const row = Array.isArray(data) ? data[0] : null;
        if (
          !row ||
          !Number.isInteger(row.revision) ||
          row.revision !== expected + 1
        ) {
          setError(
            "저장 결과를 확인하지 못했어요. 최신 계정 기록을 확인해 주세요.",
          );
          setConflict(true);
          setSaveStopped(true);
          return false;
        }
        revision.current = row.revision;
        saved.current = JSON.stringify(value);
        setLastSaved(saved.current);
        setCloud(value);
        setConflict(false);
        setSync(
          latest.current === saved.current
            ? "클라우드 저장 완료"
            : "변경 내용 저장 대기",
        );
        return true;
      } catch {
        setSaveStopped(true);
        setError(
          "네트워크 연결을 확인해 주세요. 저장되지 않은 기록은 파일로 내려받을 수 있어요.",
        );
        setSync("저장 실패");
        return false;
      } finally {
        writing.current = false;
        setSaving(false);
        setTick((t) => t + 1);
      }
    },
    [client, userId],
  );
  useEffect(() => {
    if (
      !userId ||
      mode !== userId ||
      !loaded ||
      conflict ||
      saveStopped ||
      revision.current === null ||
      serialized === saved.current
    )
      return;
    const timer = setTimeout(() => {
      if (!writing.current) void persist(JSON.parse(latest.current));
    }, 1000);
    return () => clearTimeout(timer);
  }, [serialized, userId, mode, loaded, conflict, saveStopped, persist, tick]);
  useEffect(() => {
    if (!mode || serialized === saved.current) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [serialized, mode, tick]);
  async function login(provider: "google") {
    if (!client) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const { error } = await client.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin },
      });
      if (error)
        setError("로그인을 시작하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } catch {
      setError("로그인 요청 중 연결이 끊겼어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  async function adopt(importLocal: boolean) {
    if (!user || !loaded || busy) return;
    setBusy(true);
    setError("");
    try {
      const value = importLocal
        ? cloud
          ? mergeIntoCloud(
              cloud,
              document,
              () => crypto.randomUUID(),
              new Date().toISOString(),
            )
          : structuredClone(document)
        : cloud;
      if (!value) return;
      if (importLocal && !(await persist(value))) return;
      if (!onActivate(value, user.id)) {
        setError(
          "편집 중인 생각 카드를 먼저 저장한 뒤 계정 기록을 연결해 주세요.",
        );
        return;
      }
      setMessage(
        importLocal
          ? "브라우저 원본을 유지하고 계정에 기록을 가져왔어요."
          : "계정 기록을 이어 가요. 가입 전 브라우저 기록은 그대로 남아 있어요.",
      );
      saved.current = JSON.stringify(value);
      setLastSaved(saved.current);
      setSync("클라우드 저장 완료");
    } catch (e) {
      setError(e instanceof Error ? e.message : "기록을 가져오지 못했어요.");
    } finally {
      setBusy(false);
    }
  }
  async function reloadCloud() {
    if (
      mode &&
      serialized !== saved.current &&
      !window.confirm(
        "저장되지 않은 변경이 있어요. 파일로 보관한 뒤 최신 기록으로 바꿀까요?",
      )
    )
      return;
    // Leave cloud editing before fetch so old local content can never auto-save over the fetched revision.
    onGuest();
    await load();
    setMessage(
      "최신 계정 기록을 확인한 뒤 ‘계정 기록 이어 하기’를 눌러 주세요.",
    );
  }
  async function logout() {
    if (!client) return;
    if (
      mode &&
      serialized !== saved.current &&
      !(await persist(JSON.parse(serialized)))
    ) {
      if (
        !window.confirm(
          "아직 저장되지 않은 변경이 있어요. 기록 파일을 보관한 후 로그아웃할까요?",
        )
      )
        return;
    }
    setBusy(true);
    const { error } = await client.auth.signOut({ scope: "local" });
    setBusy(false);
    if (error) {
      setError("로그아웃하지 못했어요. 다시 시도해 주세요.");
      return;
    }
    onGuest();
    setMessage("로그아웃했어요. 가입 전 브라우저 작업으로 돌아왔어요.");
    setError("");
  }
  function download() {
    const url = URL.createObjectURL(
      new Blob([serialized], { type: "application/json" }),
    );
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `byeolieum-workspace-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const shownSync =
    mode && !saving && !saveStopped && !conflict
      ? serialized === lastSaved
        ? "클라우드 저장 완료"
        : "변경 내용 저장 대기"
      : sync;
  return (
    <section className="account-panel" aria-label="계정과 클라우드 저장">
      {!open && mode ? (
        <div className="account-rail">
          <span>{shownSync}</span>
          <button className="quiet-button" onClick={onOpen}>
            계정 · 저장 확인
          </button>
        </div>
      ) : null}
      {error && (
        <p className="error" role="alert">
          {error}
          {!open && (
            <button className="quiet-button" onClick={onOpen}>
              기록·연결 확인
            </button>
          )}
        </p>
      )}
      {open ? (
        <>
          <div className="account-heading">
            <div>
              <p className="eyebrow">CONTINUE ANYWHERE</p>
              <h2>다른 기기에서도 생각을 이어 가요.</h2>
            </div>
            <button className="quiet-button" onClick={onClose}>
              닫기
            </button>
          </div>
          {!client ? (
            <p>
              계정 기능을 연결하고 있어요. 지금은 가입 없이 생각을 만들고 보관할
              수 있어요.
            </p>
          ) : !authReady ? (
            <p>로그인을 확인하고 있어요…</p>
          ) : !user ? (
            <div className="account-login">
              <div className="social-logins">
                <button
                  className="social-google"
                  disabled={busy || !providers?.google}
                  onClick={() => void login("google")}
                >
                  Google로 계속하기
                  {providers && !providers.google ? " · 연결 준비 중" : ""}
                </button>
                <button
                  className="social-kakao"
                  disabled={busy || !providers?.kakao}
                  onClick={() =>
                    window.location.assign(
                      new URL("/api/auth/kakao/start", window.location.origin)
                        .href,
                    )
                  }
                >
                  카카오로 계속하기
                  {providers && !providers.kakao ? " · 연결 준비 중" : ""}
                </button>
                <button
                  className="social-naver"
                  disabled={busy || !providers?.naver}
                  onClick={() =>
                    window.location.assign(
                      new URL("/api/auth/naver/start", window.location.origin)
                        .href,
                    )
                  }
                >
                  네이버로 계속하기
                  {providers && !providers.naver ? " · 연결 준비 중" : ""}
                </button>
              </div>
              <p>
                처음이면 계정을 만들어요. 로그인 후 선택한 기록을 계정에 저장할
                수 있어요.
              </p>
            </div>
          ) : (
            <>
              <p className="account-email">
                {["naver", "kakao"].includes(user.user_metadata?.login_provider)
                  ? user.user_metadata.display_name || "로그인한 계정"
                  : user.email || "로그인한 계정"}
              </p>
              <p>
                계정별로 기록을 보관해요. 가입 전 브라우저 원본은 덮어쓰지
                않아요.
              </p>
              {!mode && loaded ? (
                <div className="account-actions">
                  {cloud && (
                    <button
                      className="primary"
                      onClick={() => void adopt(false)}
                      disabled={busy || saving || !ready}
                    >
                      계정 기록 이어 하기
                    </button>
                  )}
                  <button
                    className="secondary"
                    onClick={() => void adopt(true)}
                    disabled={busy || saving || !ready || !importAllowed}
                  >
                    {cloud
                      ? "브라우저 아이디어를 계정에 합치기"
                      : "이 브라우저 기록을 계정에 저장"}
                  </button>
                </div>
              ) : mode ? (
                <>
                  <p className="account-sync" role="status">
                    {shownSync}
                  </p>
                  <p className="small-muted">
                    변경 후 1초 뒤 저장해요. 저장 완료를 확인한 뒤 다른 기기에서
                    이어 가세요.
                  </p>
                  <div className="account-actions">
                    <button
                      className="secondary"
                      disabled={busy || conflict || saving}
                      onClick={() => void persist(JSON.parse(serialized))}
                    >
                      지금 계정에 저장
                    </button>
                    <button
                      className="secondary"
                      disabled={busy || saving}
                      onClick={() => void reloadCloud()}
                    >
                      최신 계정 기록 확인
                    </button>
                  </div>
                </>
              ) : (
                <p>계정 기록을 확인하고 있어요…</p>
              )}
              <div className="account-actions">
                {!mode && (
                  <button
                    className="quiet-button"
                    disabled={busy}
                    onClick={() => void load()}
                  >
                    연결 다시 확인
                  </button>
                )}
                <button className="quiet-button" onClick={download}>
                  현재 기록 파일 내려받기
                </button>
                <button
                  className="quiet-button"
                  disabled={busy}
                  onClick={() => void logout()}
                >
                  로그아웃
                </button>
              </div>
            </>
          )}
          {message && (
            <p className="notice" role="status">
              {message}
            </p>
          )}
          <p className="small-muted">가입 없이 체험은 계속 사용할 수 있어요.</p>
        </>
      ) : null}
    </section>
  );
}
