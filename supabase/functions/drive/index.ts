// Edge Function "drive": OAuth 2.0 Authorization Code (server-side) + operasi Google Drive.
// Secret hanya dibaca dari environment Supabase; refresh token disimpan terenkripsi AES-GCM.
import { createClient } from "npm:@supabase/supabase-js@2";
const E = (k: string) => Deno.env.get(k)!;
const admin = createClient(E("SUPABASE_URL"), E("SUPABASE_SERVICE_ROLE_KEY"));
const APP = E("APP_URL"), CID = E("GOOGLE_CLIENT_ID"), CSEC = E("GOOGLE_CLIENT_SECRET");
const REDIRECT = `${E("SUPABASE_URL")}/functions/v1/drive/callback`;
const SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";
const H = { "Access-Control-Allow-Origin": new URL(APP).origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type", "Access-Control-Allow-Methods": "POST, GET, OPTIONS", Vary: "Origin" };
class Err extends Error { constructor(public code: string, public status = 400, msg?: string) { super(msg || code); } }
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...H, "Content-Type": "application/json" } });

const rawKey = () => Uint8Array.from(atob(E("TOKEN_ENC_KEY")), (c) => c.charCodeAt(0));
const aes = () => crypto.subtle.importKey("raw", rawKey(), "AES-GCM", false, ["encrypt", "decrypt"]);
const hmac = () => crypto.subtle.importKey("raw", rawKey(), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
async function enc(t: string) { const iv = crypto.getRandomValues(new Uint8Array(12)); const c = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aes(), new TextEncoder().encode(t))); return b64(new Uint8Array([...iv, ...c])); }
async function dec(s: string) { const b = Uint8Array.from(atob(s), (c) => c.charCodeAt(0)); return new TextDecoder().decode(await crypto.subtle.decrypt({ name: "AES-GCM", iv: b.slice(0, 12) }, await aes(), b.slice(12))); }
async function sign(s: string) { return b64(new Uint8Array(await crypto.subtle.sign("HMAC", await hmac(), new TextEncoder().encode(s)))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

async function auth(req: Request) {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer /i, "");
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data.user) throw new Err("unauthorized", 401);
  return data.user.id;
}
const conn = async (uid: string) => (await admin.from("drive_connections").select("*").eq("user_id", uid).maybeSingle()).data;
async function tok(uid: string) {
  const c = await conn(uid);
  if (!c || c.status === "disconnected") throw new Err("not_connected");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: CID, client_secret: CSEC, refresh_token: await dec(c.refresh_token_enc), grant_type: "refresh_token" }) });
  const j = await r.json();
  if (!r.ok) { if (j.error === "invalid_grant") await admin.from("drive_connections").update({ status: "expired" }).eq("user_id", uid); throw new Err("token_expired", 401); }
  return { t: j.access_token as string, c };
}
async function G(url: string, t: string, init: RequestInit = {}) {
  const r = await fetch(url, { ...init, headers: { ...(init.headers || {}), Authorization: `Bearer ${t}` } });
  if (r.ok) return r;
  const tx = await r.text();
  if (r.status === 401) throw new Err("token_expired", 401);
  if (/storageQuotaExceeded|quotaExceeded/i.test(tx)) throw new Err("quota", 507);
  if (r.status === 404) throw new Err("folder_missing", 404);
  throw new Err("drive_error", r.status, tx.slice(0, 200));
}
const FILES = "https://www.googleapis.com/drive/v3/files";
async function mkFolder(t: string, name: string) {
  const r = await G(`${FILES}?fields=id,name`, t, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, mimeType: "application/vnd.google-apps.folder" }) });
  return await r.json();
}
async function callback(u: URL) {
  const back = (q: string) => new Response(null, { status: 302, headers: { Location: APP.split("#")[0].split("?")[0] + "?" + q + "#me" } });
  if (u.searchParams.get("error")) return back("drive=error&reason=" + encodeURIComponent(u.searchParams.get("error")!));
  const [uid, exp, sig] = (u.searchParams.get("state") || "").split(".");
  if (!uid || !exp || +exp < Date.now() || sig !== await sign(uid + "." + exp)) return back("drive=error&reason=state");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ code: u.searchParams.get("code") || "", client_id: CID, client_secret: CSEC, redirect_uri: REDIRECT, grant_type: "authorization_code" }) });
  const j = await r.json();
  if (!r.ok || !j.refresh_token) return back("drive=error&reason=no_refresh_token");
  if (!String(j.scope).includes("drive.file")) return back("drive=error&reason=scope_denied");
  const me = await (await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: "Bearer " + j.access_token } })).json();
  const old = await conn(uid);
  const row: Record<string, unknown> = { user_id: uid, google_email: me.email, refresh_token_enc: await enc(j.refresh_token), status: "connected", updated_at: new Date().toISOString() };
  if (!old?.folder_id) { const f = await mkFolder(j.access_token, "Lumen Photos"); row.folder_id = f.id; row.folder_name = f.name; }
  const { error } = await admin.from("drive_connections").upsert(row);
  return back(error ? "drive=error&reason=db" : "drive=connected");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.pathname.endsWith("/callback")) return await callback(url);
    const uid = await auth(req);
    const b = await req.json();
    switch (b.action) {
      case "start": {
        const exp = Date.now() + 600000, state = `${uid}.${exp}.${await sign(uid + "." + exp)}`;
        return json({ url: "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: CID, redirect_uri: REDIRECT, response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent", state }) });
      }
      case "status": {
        const c = await conn(uid);
        return json(c ? { connected: c.status !== "disconnected", status: c.status, email: c.google_email, folder_id: c.folder_id, folder_name: c.folder_name, auto_backup: c.auto_backup } : { connected: false });
      }
      case "disconnect": {
        const c = await conn(uid);
        if (c) { try { await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", body: new URLSearchParams({ token: await dec(c.refresh_token_enc) }) }); } catch { /* best effort */ } await admin.from("drive_connections").delete().eq("user_id", uid); }
        return json({ ok: true });
      }
      case "list_folders": {
        const { t } = await tok(uid);
        const r = await G(`${FILES}?` + new URLSearchParams({ q: "mimeType='application/vnd.google-apps.folder' and trashed=false", fields: "files(id,name)", pageSize: "100", orderBy: "name" }), t);
        return json({ folders: (await r.json()).files || [] });
      }
      case "create_folder": {
        const name = String(b.name || "").trim().slice(0, 100); if (!name) throw new Err("bad_request");
        const { t } = await tok(uid), f = await mkFolder(t, name);
        await admin.from("drive_connections").update({ folder_id: f.id, folder_name: f.name }).eq("user_id", uid);
        return json(f);
      }
      case "set_folder": {
        const { t } = await tok(uid);
        const f = await (await G(`${FILES}/${encodeURIComponent(String(b.id))}?fields=id,name,trashed,mimeType`, t)).json();
        if (f.trashed || f.mimeType !== "application/vnd.google-apps.folder") throw new Err("folder_missing", 404);
        await admin.from("drive_connections").update({ folder_id: f.id, folder_name: f.name }).eq("user_id", uid);
        return json({ ok: true });
      }
      case "set_auto": {
        await admin.from("drive_connections").update({ auto_backup: !!b.value }).eq("user_id", uid);
        return json({ ok: true });
      }
      case "init_upload": {
        const { t, c } = await tok(uid);
        if (!c.folder_id) throw new Err("folder_missing", 404);
        const f = await (await G(`${FILES}/${c.folder_id}?fields=trashed`, t)).json();
        if (f.trashed) throw new Err("folder_missing", 404);
        const r = await G("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", t, { method: "POST",
          headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": String(b.mime || "application/octet-stream"), "X-Upload-Content-Length": String(b.size || 0), Origin: req.headers.get("origin") || new URL(APP).origin },
          body: JSON.stringify({ name: String(b.name || "photo").slice(0, 200), parents: [c.folder_id] }) });
        return json({ uploadUrl: r.headers.get("location") });
      }
      case "download": {
        const fid = String(b.file_id || "");
        if (!/^[\w-]+$/.test(fid)) throw new Err("forbidden", 403);
        const { data: own } = await admin.from("photos").select("id").eq("user_id", uid).or(`google_drive_file_id.eq.${fid},backup_drive_file_id.eq.${fid}`).limit(1);
        if (!own?.length) throw new Err("forbidden", 403);
        const { t } = await tok(uid), r = await G(`${FILES}/${fid}?alt=media`, t);
        return new Response(r.body, { headers: { ...H, "Content-Type": r.headers.get("content-type") || "application/octet-stream" } });
      }
      default: throw new Err("bad_request");
    }
  } catch (e) {
    const x = e instanceof Err ? e : new Err("error", 500, String(e));
    return json({ code: x.code, message: x.message }, x.status);
  }
});
