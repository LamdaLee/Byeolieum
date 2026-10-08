import "server-only";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  digest,
  internalNaverEmail,
  sealSession,
  openSession,
} from "./naver-crypto";
export const STATE_COOKIE = "byeolieum_naver_state";
export const HANDOFF_COOKIE = "byeolieum_naver_handoff";
export function naverConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const clientId = process.env.NAVER_CLIENT_ID,
    clientSecret = process.env.NAVER_CLIENT_SECRET;
  const origin = new URL(process.env.AUTH_SITE_URL || "https://byeolieum.com")
    .origin;
  return {
    url,
    publishable,
    service,
    clientId,
    clientSecret,
    origin,
    enabled: Boolean(url && publishable && service && clientId && clientSecret),
  };
}
export function nonce() {
  return randomBytes(32).toString("base64url");
}
export function cookieOptions(origin: string, maxAge: number) {
  return {
    httpOnly: true,
    secure: origin.startsWith("https:"),
    sameSite: "lax" as const,
    path: "/api/auth/naver",
    maxAge,
  };
}
function clients() {
  const config = naverConfig();
  if (!config.enabled) throw new Error("Naver unavailable");
  const deadline = AbortSignal.timeout(35000);
  const boundedFetch: typeof fetch = (input, init) =>
    fetch(input, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, deadline])
        : deadline,
    });
  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: boundedFetch },
  };
  return {
    config,
    boundedFetch,
    admin: createClient(config.url!, config.service!, options),
    sessionClient: createClient(config.url!, config.publishable!, options),
  };
}
export async function completeNaver(code: string, state: string) {
  const { config, boundedFetch, admin, sessionClient } = clients();
  const tokenResponse = await boundedFetch(
    "https://nid.naver.com/oauth2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId!,
        client_secret: config.clientSecret!,
        code,
        state,
      }),
    },
  );
  if (!tokenResponse.ok) throw new Error("Provider token failed");
  const token = await tokenResponse.json();
  if (typeof token.access_token !== "string" || !token.access_token)
    throw new Error("Invalid provider token");
  const profileResponse = await boundedFetch(
    "https://openapi.naver.com/v1/nid/me",
    { headers: { Authorization: `Bearer ${token.access_token}` } },
  );
  if (!profileResponse.ok) throw new Error("Provider identity failed");
  const profile = await profileResponse.json();
  if (
    profile.resultcode !== "00" ||
    typeof profile.response?.id !== "string" ||
    !profile.response.id ||
    profile.response.id.length > 500
  )
    throw new Error("Invalid provider identity");
  const subject = digest(`naver:${profile.response.id}`);
  const { data: existing, error: lookupError } = await admin
    .from("naver_identities")
    .select("user_id")
    .eq("subject_hash", subject)
    .maybeSingle();
  if (lookupError) throw new Error("Identity store unavailable");
  let email = internalNaverEmail(profile.response.id, config.service!);
  if (existing) {
    const { data, error } = await admin.auth.admin.getUserById(
      existing.user_id,
    );
    if (error || !data.user?.email)
      throw new Error("Identity account unavailable");
    email = data.user.email;
  }
  const displayName =
    typeof profile.response.nickname === "string"
      ? profile.response.nickname.slice(0, 80)
      : "네이버 사용자";
  // generateLink creates a new magiclink user if needed; it does not send an email.
  // The private subject mapping and keyed internal address prevent email-based impersonation/merging.
  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { data: { display_name: displayName, login_provider: "naver" } },
  });
  const userId = generated.data.user?.id,
    hashedToken = generated.data.properties?.hashed_token;
  if (
    generated.error ||
    !userId ||
    !hashedToken ||
    (existing && userId !== existing.user_id)
  )
    throw new Error("Account login failed");
  const inserted = await admin
    .from("naver_identities")
    .upsert(
      { subject_hash: subject, user_id: userId },
      { onConflict: "subject_hash", ignoreDuplicates: true },
    );
  if (inserted.error) throw new Error("Identity registration failed");
  const mapped = await admin
    .from("naver_identities")
    .select("user_id")
    .eq("subject_hash", subject)
    .single();
  if (mapped.error || mapped.data.user_id !== userId)
    throw new Error("Identity mismatch");
  const verificationType = generated.data.properties?.verification_type;
  if (verificationType !== "magiclink" && verificationType !== "signup")
    throw new Error("Unexpected verification type");
  const verified = await sessionClient.auth.verifyOtp({
    token_hash: hashedToken,
    type: verificationType,
  });
  if (
    verified.error ||
    !verified.data.session ||
    verified.data.user?.id !== userId
  )
    throw new Error("Session verification failed");
  const session = verified.data.session,
    handoff = nonce();
  await admin
    .from("naver_login_handoffs")
    .delete()
    .lt("expires_at", new Date().toISOString());
  const stored = await admin.from("naver_login_handoffs").insert({
    nonce_hash: digest(handoff),
    sealed_session: sealSession(
      {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      },
      config.service!,
    ),
    expires_at: new Date(Date.now() + 60000).toISOString(),
  });
  if (stored.error) throw new Error("Session handoff failed");
  return handoff;
}
export async function consumeNaver(handoff: string) {
  const { config, admin } = clients();
  if (handoff.length > 128) throw new Error("Invalid handoff");
  const { data, error } = await admin.rpc("consume_naver_handoff", {
    p_nonce_hash: digest(handoff),
  });
  if (
    error ||
    !Array.isArray(data) ||
    data.length !== 1 ||
    typeof data[0].sealed_session !== "string"
  )
    throw new Error("Expired handoff");
  return openSession(data[0].sealed_session, config.service!);
}
