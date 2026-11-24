// Edge Function "drive": OAuth 2.0 Authorization Code (server-side) + operasi Google Drive.
// Secret hanya dibaca dari environment Supabase; refresh token disimpan terenkripsi AES-GCM.
import { createClient } from "npm:@supabase/supabase-js@2";
const E = (k: string) => Deno.env.get(k)!;
const admin = createClient(E("SUPABASE_URL"), E("SUPABASE_SERVICE_ROLE_KEY"));
const APP = E("APP_URL"), CID = E("GOOGLE_CLIENT_ID"), CSEC = E("GOOGLE_CLIENT_SECRET");
const REDIRECT = `${E("SUPABASE_URL")}/functions/v1/drive/callback`;
const SCOPE = "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email";
const H = { "Access-Control-Allow-Origin": new URL(APP).origin, "Access-Control-Allow-Headers": "authorization, apikey, content-type, range", "Access-Control-Allow-Methods": "POST, GET, HEAD, OPTIONS", "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges", Vary: "Origin" };
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
const OPT = (k: string) => Deno.env.get(k) || "";
// ---- Banyak akun Google per pengguna: tiap akun = 1 baris drive_connections (id uuid). is_default = akun tujuan upload bawaan. ----
const conns = async (uid: string) => ((await admin.from("drive_connections").select("*").eq("user_id", uid).order("created_at")).data || []) as any[];
const pick = (l: any[], id?: string) => (id ? l.find((c) => c.id === id) : (l.find((c) => c.is_default) || l[0])) || null;
async function tok(uid: string, id?: string) {
  const c = pick(await conns(uid), id);
  if (!c || c.status === "disconnected") throw new Err("not_connected");
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", body: new URLSearchParams({ client_id: CID, client_secret: CSEC, refresh_token: await dec(c.refresh_token_enc), grant_type: "refresh_token" }) });
  const j = await r.json();
  if (!r.ok) { if (j.error === "invalid_grant") await admin.from("drive_connections").update({ status: "expired" }).eq("id", c.id); throw new Err("token_expired", 401); }
  return { t: j.access_token as string, c };
}
const TC = new Map<string, { t: string; e: number }>();
async function tokCached(uid: string, cid?: string) {
  const k = cid || "d:" + uid, h = TC.get(k);
  if (h && h.e > Date.now()) return h.t;
  const { t } = await tok(uid, cid || undefined);
  TC.set(k, { t, e: Date.now() + 40 * 60000 });
  return t;
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
  if (!String(j.scope).includes("drive.readonly")) return back("drive=error&reason=scope_denied");
  const me = await (await fetch("https://www.googleapis.com/oauth2/v2/userinfo", { headers: { Authorization: "Bearer " + j.access_token } })).json();
  const list = await conns(uid), old = list.find((c) => c.google_email === me.email);
  const row: Record<string, unknown> = { user_id: uid, google_email: me.email, refresh_token_enc: await enc(j.refresh_token), status: "connected", updated_at: new Date().toISOString() };
  if (!old?.folder_id) { const f = await mkFolder(j.access_token, "MIKA Photos"); row.folder_id = f.id; row.folder_name = f.name; }
  if (old) row.id = old.id; else row.is_default = list.length === 0;   // akun pertama otomatis jadi default
  const { error } = old ? await admin.from("drive_connections").update(row).eq("id", old.id) : await admin.from("drive_connections").insert(row);
  return back(error ? "drive=error&reason=db" : "drive=connected");
}

// ---- Streaming video Drive untuk <video>: URL bertanda tangan (HMAC) + dukungan Range (bisa seek) ----
const FID = /^[\w-]+$/, VMIME = /^video\/[\w.+-]+$/;
async function owns(uid: string, fid: string) {
  const { data } = await admin.from("photos").select("id,drive_conn_id").eq("user_id", uid).or(`google_drive_file_id.eq.${fid},backup_drive_file_id.eq.${fid}`).limit(1);
  return { ok: !!data?.length, cid: (data?.[0]?.drive_conn_id as string) || "" };
}
// URL stream bertanda tangan (HMAC: user + file + kedaluwarsa + akun Drive). Mendukung Range (seek). Tipe MIME dari klien dipakai bila Drive mengirim octet-stream.
async function stream(req: Request, u: URL) {
  const uid = u.searchParams.get("u") || "", fid = u.searchParams.get("f") || "", exp = u.searchParams.get("e") || "", cid = u.searchParams.get("c") || "", sig = u.searchParams.get("s") || "", m = u.searchParams.get("m") || "";
  if (!uid || !FID.test(fid) || !(+exp > Date.now()) || sig !== await sign(`s.${uid}.${fid}.${exp}.${cid}`)) throw new Err("forbidden", 403);
  const range = req.headers.get("range");
  const get = async (t: string) => await G(`${FILES}/${fid}?alt=media`, t, range ? { headers: { Range: range } } : {});
  let r!: Response;
  try { r = await get(await tokCached(uid, cid)); }
  catch (e) { if (e instanceof Err && e.code === "token_expired") { TC.delete(cid || "d:" + uid); r = await get(await tokCached(uid, cid)); } else throw e; }
  let ct = r.headers.get("content-type") || "";
  if ((!ct || /octet-stream/i.test(ct)) && VMIME.test(m)) ct = m;
  const h: Record<string, string> = { ...H, "Content-Type": ct || "video/mp4", "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=3600" };
  for (const k of ["content-length", "content-range"]) { const v = r.headers.get(k); if (v) h[k] = v; }
  return new Response(req.method === "HEAD" ? null : r.body, { status: r.status, headers: h });
}
const META = "id,name,mimeType,size,createdTime,thumbnailLink,trashed,imageMediaMetadata(width,height,time),videoMediaMetadata(width,height,durationMillis)";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: H });
  const url = new URL(req.url);
  try {
    if (req.method === "GET" && url.pathname.endsWith("/callback")) return await callback(url);
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.endsWith("/stream")) return await stream(req, url);
    const uid = await auth(req);
    const b = await req.json();
    switch (b.action) {
      case "start": {
        const exp = Date.now() + 600000, state = `${uid}.${exp}.${await sign(uid + "." + exp)}`;
        return json({ url: "https://accounts.google.com/o/oauth2/v2/auth?" + new URLSearchParams({ client_id: CID, redirect_uri: REDIRECT, response_type: "code", scope: SCOPE, access_type: "offline", prompt: "consent select_account", state }) });
      }
      case "status": {
        const l = await conns(uid), d = pick(l);
        return json({ connected: !!d && d.status !== "disconnected", status: d?.status, email: d?.google_email, folder_id: d?.folder_id, folder_name: d?.folder_name, auto_backup: d?.auto_backup,
          drives: l.map((c) => ({ id: c.id, email: c.google_email, status: c.status, folder_id: c.folder_id, folder_name: c.folder_name, auto_backup: c.auto_backup, is_default: !!c.is_default })) });
      }
      case "disconnect": {
        const l = await conns(uid), c = pick(l, b.conn_id);
        if (c) {
          try { await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", body: new URLSearchParams({ token: await dec(c.refresh_token_enc) }) }); } catch { /* best effort */ }
          await admin.from("drive_connections").delete().eq("id", c.id); TC.delete(c.id);
          const rest = l.filter((x) => x.id !== c.id);
          if (c.is_default && rest.length) await admin.from("drive_connections").update({ is_default: true }).eq("id", rest[0].id);
        }
        return json({ ok: true });
      }
      case "set_default": {
        const c = pick(await conns(uid), String(b.conn_id || "")); if (!c) throw new Err("not_connected");
        await admin.from("drive_connections").update({ is_default: false }).eq("user_id", uid);
        await admin.from("drive_connections").update({ is_default: true }).eq("id", c.id);
        return json({ ok: true });
      }
      case "list_folders": {
        const { t } = await tok(uid, b.conn_id);
        const r = await G(`${FILES}?` + new URLSearchParams({ q: "mimeType='application/vnd.google-apps.folder' and trashed=false", fields: "files(id,name)", pageSize: "100", orderBy: "name" }), t);
        return json({ folders: (await r.json()).files || [] });
      }
      case "create_folder": {
        const name = String(b.name || "").trim().slice(0, 100); if (!name) throw new Err("bad_request");
        const { t, c } = await tok(uid, b.conn_id), f = await mkFolder(t, name);
        await admin.from("drive_connections").update({ folder_id: f.id, folder_name: f.name }).eq("id", c.id);
        return json(f);
      }
      case "set_folder": {
        const { t, c } = await tok(uid, b.conn_id);
        const f = await (await G(`${FILES}/${encodeURIComponent(String(b.id))}?fields=id,name,trashed,mimeType`, t)).json();
        if (f.trashed || f.mimeType !== "application/vnd.google-apps.folder") throw new Err("folder_missing", 404);
        await admin.from("drive_connections").update({ folder_id: f.id, folder_name: f.name }).eq("id", c.id);
        return json({ ok: true });
      }
      case "set_auto": {
        const c = pick(await conns(uid), b.conn_id); if (!c) throw new Err("not_connected");
        await admin.from("drive_connections").update({ auto_backup: !!b.value }).eq("id", c.id);
        return json({ ok: true });
      }
      case "init_upload": {
        const { t, c } = await tok(uid, b.conn_id);
        if (!c.folder_id) throw new Err("folder_missing", 404);
        const f = await (await G(`${FILES}/${c.folder_id}?fields=trashed`, t)).json();
        if (f.trashed) throw new Err("folder_missing", 404);
        const r = await G("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", t, { method: "POST",
          headers: { "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": String(b.mime || "application/octet-stream"), "X-Upload-Content-Length": String(b.size || 0), Origin: req.headers.get("origin") || new URL(APP).origin },
          body: JSON.stringify({ name: String(b.name || "photo").slice(0, 200), parents: [c.folder_id] }) });
        return json({ uploadUrl: r.headers.get("location"), conn_id: c.id });
      }
      case "stream_url": {
        const fid = String(b.file_id || "");
        if (!FID.test(fid)) throw new Err("forbidden", 403);
        const o = await owns(uid, fid); let cid = o.cid;
        if (!o.ok) {   // belum ada di perpustakaan (mis. pratinjau saat impor): cukup bukti bahwa akun Drive pengguna sendiri bisa membaca file ini
          if (!b.conn_id) throw new Err("forbidden", 403);
          const { t, c } = await tok(uid, String(b.conn_id)); await G(`${FILES}/${fid}?supportsAllDrives=true&fields=id`, t); cid = c.id;
        }
        const exp = Date.now() + 6 * 3600000, sig = await sign(`s.${uid}.${fid}.${exp}.${cid}`), q: Record<string, string> = { u: uid, f: fid, e: String(exp), c: cid, s: sig };
        if (VMIME.test(String(b.mime || ""))) q.m = String(b.mime);
        return json({ url: `${E("SUPABASE_URL")}/functions/v1/drive/stream?` + new URLSearchParams(q) });
      }
      case "download": {
        const fid = String(b.file_id || "");
        if (!FID.test(fid)) throw new Err("forbidden", 403);
        const o = await owns(uid, fid);
        if (!o.ok) throw new Err("forbidden", 403);
        const { t } = await tok(uid, o.cid || undefined), r = await G(`${FILES}/${fid}?alt=media&supportsAllDrives=true`, t);
        return new Response(r.body, { headers: { ...H, "Content-Type": r.headers.get("content-type") || "application/octet-stream" } });
      }
      // ---- Daftar media untuk pemilih file bawaan MIKA; tidak memakai Google Picker iframe/API key ----
      case "list_media": {
        const { t } = await tok(uid, b.conn_id);
        const term = String(b.search || "").trim().slice(0, 100).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        let q = "trashed = false and (mimeType contains 'image/' or mimeType contains 'video/')";
        if (term) q += " and name contains '" + term + "'";
        const params = new URLSearchParams({
          q, pageSize: "50", orderBy: "createdTime desc",
          supportsAllDrives: "true", includeItemsFromAllDrives: "true",
          corpora: "allDrives",
          fields: "nextPageToken,incompleteSearch,files(" + META + ")"
        });
        if (b.page_token) params.set("pageToken", String(b.page_token));
        const r = await G(`${FILES}?${params}`, t), j = await r.json();
        return json({ files: j.files || [], next_page_token: j.nextPageToken || "", incomplete_search: !!j.incompleteSearch });
      }
      case "import_info": {
        const { t, c } = await tok(uid, b.conn_id), ids = (Array.isArray(b.ids) ? b.ids : []).map(String).filter((x: string) => FID.test(x)).slice(0, 50), out: unknown[] = [], skipped: unknown[] = [];
        for (const id of ids) {
          try {
            const f = await (await G(`${FILES}/${id}?supportsAllDrives=true&fields=${encodeURIComponent(META)}`, t)).json();
            if (f.trashed || !/^(image|video)\//.test(f.mimeType || "")) { skipped.push({ id, code: "not_media" }); continue; }
            out.push({ id: f.id, name: f.name, mime: f.mimeType, size: +f.size || 0, created: f.createdTime, w: f.imageMediaMetadata?.width || f.videoMediaMetadata?.width || 0, h: f.imageMediaMetadata?.height || f.videoMediaMetadata?.height || 0, dur: Math.round((+f.videoMediaMetadata?.durationMillis || 0) / 1000), taken: f.imageMediaMetadata?.time || "" });
          } catch (e) { skipped.push({ id, code: e instanceof Err ? e.code : "drive_error" }); }
        }
        return json({ files: out, skipped, conn_id: c.id });
      }
      case "import_download": {
        const fid = String(b.file_id || ""); if (!FID.test(fid)) throw new Err("forbidden", 403);
        const t = await tokCached(uid, String(b.conn_id || ""));
        const meta = await (await G(`${FILES}/${fid}?supportsAllDrives=true&fields=id,mimeType,trashed,size`, t)).json();
        if (meta.trashed || !/^(image|video)\//.test(meta.mimeType || "")) throw new Err("not_media", 400);
        const r = await G(`${FILES}/${fid}?alt=media&supportsAllDrives=true`, t);
        const headers: Record<string, string> = { ...H, "Content-Type": meta.mimeType || r.headers.get("content-type") || "application/octet-stream", "Cache-Control": "no-store" };
        const len = r.headers.get("content-length"); if (len) headers["Content-Length"] = len;
        return new Response(r.body, { headers });
      }
      case "import_thumb": {
        const fid = String(b.file_id || ""); if (!FID.test(fid)) throw new Err("forbidden", 403);
        const cid = String(b.conn_id || ""), t = await tokCached(uid, cid), f = await (await G(`${FILES}/${fid}?supportsAllDrives=true&fields=${encodeURIComponent(META)}`, t)).json();
        if (f.thumbnailLink) {
          const r = await fetch(String(f.thumbnailLink).replace(/=s\d+$/, "=s800"), { headers: { Authorization: `Bearer ${t}` } });
          if (r.ok && /^image\//.test(r.headers.get("content-type") || "")) return new Response(r.body, { headers: { ...H, "Content-Type": r.headers.get("content-type")! } });
        }
        if (/^image\//.test(f.mimeType || "") && (+f.size || 0) <= 15 * 1048576) { const r = await G(`${FILES}/${fid}?alt=media&supportsAllDrives=true`, t); return new Response(r.body, { headers: { ...H, "Content-Type": f.mimeType } }); }
        throw new Err("no_thumb", 404);
      }
      default: throw new Err("bad_request");
    }
  } catch (e) {
    const x = e instanceof Err ? e : new Err("error", 500, String(e));
    return json({ code: x.code, message: x.message }, x.status);
  }
});
