import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function internalNaverEmail(subject: string, key: string) {
  return `naver-${createHmac("sha256", key).update(subject).digest("hex").slice(0, 32)}@accounts.byeolieum.com`;
}
export function equalState(a: string | undefined, b: string | null) {
  if (!a || !b || a.length > 128 || b.length > 128) return false;
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function encryptionKey(secret: string) {
  return createHash("sha256")
    .update(`byeolieum-naver-handoff:${secret}`)
    .digest();
}
export function sealSession(
  session: { access_token: string; refresh_token: string },
  secret: string,
) {
  const iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", encryptionKey(secret), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(session), "utf8"),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((p) => p.toString("base64url"))
    .join(".");
}
export function openSession(
  value: string,
  secret: string,
): { access_token: string; refresh_token: string } {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid handoff");
  const [iv, tag, body] = parts.map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(secret), iv);
  decipher.setAuthTag(tag);
  const session = JSON.parse(
    Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"),
  );
  if (
    typeof session.access_token !== "string" ||
    !session.access_token ||
    typeof session.refresh_token !== "string" ||
    !session.refresh_token
  )
    throw new Error("Invalid session");
  return session;
}
