"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
let client: SupabaseClient | null = null;
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  try {
    if (!client)
      client = createClient(url, key, {
        auth: {
          flowType: "pkce",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
  } catch {
    return null;
  }
  return client;
}
export async function getLoginProviders(
  signal: AbortSignal,
): Promise<{ google: boolean; kakao: boolean; naver: boolean }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing public configuration");
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, {
    headers: { apikey: key },
    signal,
  });
  if (!response.ok) throw new Error("Cannot load login providers");
  const settings = await response.json();
  const kakao = await fetch("/api/auth/kakao/status", { signal })
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .catch(() => ({ enabled: false }));
  const naver = await fetch("/api/auth/naver/status", { signal })
    .then((r) => (r.ok ? r.json() : { enabled: false }))
    .catch(() => ({ enabled: false }));
  return {
    naver: naver.enabled === true,
    google: settings.external?.google === true,
    kakao: kakao.enabled === true,
  };
}
