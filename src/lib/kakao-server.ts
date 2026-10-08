import "server-only";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import {
  digest,
  internalSocialEmail,
  sealSession,
  openSession,
} from "./naver-crypto";
export const STATE_COOKIE = "byeolieum_kakao_state";
export const HANDOFF_COOKIE = "byeolieum_kakao_handoff";
export function kakaoConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const publishable =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const clientId = process.env.KAKAO_CLIENT_ID,
    clientSecret = process.env.KAKAO_CLIENT_SECRET;
  const origin = new URL(process.env.AUTH_SITE_URL || "https://byeolieum.com")
    .origin;
  return {
    url,
    publishable,
    service,
    clientId,
    clientSecret,
    origin,
    enabled: Boolean(url && publishable && service && clientId),
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
    path: "/api/auth/kakao",
    maxAge,
  };
}
function clients() {
  const config = kakaoConfig();
  if (!config.enabled) throw new Error("Kakao unavailable");
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
export async function completeKakao(code: string) {
  const { config, boundedFetch, admin, sessionClient } = clients();
  const tokenResponse = await boundedFetch(
    "https://kauth.kakao.com/oauth/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId!,
        ...(config.clientSecret ? { client_secret: config.clientSecret } : {}),
        redirect_uri: `${config.origin}/api/auth/kakao/callback`,
        code,
      }),
    },
  );
  if (!tokenResponse.ok) throw new Error("Provider token failed");
  const token = await tokenResponse.json();
  if (typeof token.access_token !== "string" || !token.access_token)
    throw new Error("Invalid provider token");
  // Empty property_keys requests no account/profile properties, including previously consented ones.
  const profileResponse = await boundedFetch(
    "https://kapi.kakao.com/v2/user/me?property_keys=%5B%5D",
    {
      headers: { Authorization: `Bearer ${token.access_token}` },
    },
  );
  if (!profileResponse.ok) throw new Error("Provider identity failed");
  const profile = await profileResponse.json();
  if (!Number.isSafeInteger(profile.id) || profile.id <= 0)
    throw new Error("Invalid provider identity");
  const subjectId = String(profile.id),
    subject = digest(`kakao:${subjectId}`);
  const { data: existing, error: lookupError } = await admin
    .from("kakao_identities")
    .select("user_id")
    .eq("subject_hash", subject)
    .maybeSingle();
  if (lookupError) throw new Error("Identity store unavailable");
  let email = internalSocialEmail("kakao", subjectId, config.service!);
  if (existing) {
    const { data, error } = await admin.auth.admin.getUserById(
      existing.user_id,
    );
    if (error || !data.user?.email)
      throw new Error("Identity account unavailable");
    email = data.user.email;
  }
  const displayName = "카카오 계정";
  // generateLink creates a new magiclink user if needed; it does not send an email.
  // The private subject mapping and keyed internal address prevent email-based impersonation/merging.
  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: { data: { display_name: displayName, login_provider: "kakao" } },
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
    .from("kakao_identities")
    .upsert(
      { subject_hash: subject, user_id: userId },
      { onConflict: "subject_hash", ignoreDuplicates: true },
    );
  if (inserted.error) throw new Error("Identity registration failed");
  const mapped = await admin
    .from("kakao_identities")
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
    .from("kakao_login_handoffs")
    .delete()
    .lt("expires_at", new Date().toISOString());
  const stored = await admin.from("kakao_login_handoffs").insert({
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
export async function consumeKakao(handoff: string) {
  const { config, admin } = clients();
  if (handoff.length > 128) throw new Error("Invalid handoff");
  const { data, error } = await admin.rpc("consume_kakao_handoff", {
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
