// Adapter: menyediakan API window.claude.use("user"|"db"|"assets"|"downloads") di atas Supabase,
// sehingga seluruh logika UI Lumen Photos yang lama tetap berjalan tanpa diubah.
(()=>{const C=window.LUMEN_CONFIG||{};
if(!C.SUPABASE_URL||!C.SUPABASE_ANON_KEY){window.claude=null;return}
const sb=supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
window.sb=sb;let uid,SP;const R={},L={},TM={},RT=new Set(),META=new Map();
const OR="lumen_orphans",orph=()=>{try{return JSON.parse(localStorage.getItem(OR)||"[]")}catch(e){return[]}},setOr=a=>{try{localStorage.setItem(OR,JSON.stringify(a))}catch(e){}};
function login(){return new Promise(ok=>{const s=document.createElement("div");s.className="sheet";
s.innerHTML=`<div><h3 style="margin-top:0">Masuk ke Lumen Photos</h3><input id=le type=email placeholder=Email autocomplete=email style="margin-bottom:8px"><input id=lp type=password placeholder=Password autocomplete=current-password style="margin-bottom:10px"><div id=lm class=mu style="min-height:20px;margin-bottom:8px;font-size:13px"></div><div style="display:flex;gap:8px"><button class=chip id=lr style="flex:1">Daftar</button><button class=btn id=li style="flex:2">Masuk</button></div></div>`;
document.body.append(s);const m=s.querySelector("#lm"),go=async up=>{const c={email:s.querySelector("#le").value.trim(),password:s.querySelector("#lp").value};if(!c.email||!c.password){m.textContent="Isi email dan password.";return}m.textContent="Memproses…";
let r;try{r=up?await sb.auth.signUp(c):await sb.auth.signInWithPassword(c)}catch(e){m.textContent="Koneksi internet terputus.";return}
if(r.error){m.textContent=r.error.message;return}if(!r.data.session){m.textContent="Cek email untuk konfirmasi, lalu masuk.";return}s.remove();ok(r.data.session)};
s.querySelector("#li").onclick=()=>go(0);s.querySelector("#lr").onclick=()=>go(1);s.querySelector("#lp").onkeydown=e=>{if(e.key=="Enter")go(0)}})}
const ses=()=>SP||(SP=sb.auth.getSession().then(async r=>{const s=r.data.session||await login();uid=s.user.id;return s}));
sb.auth.onAuthStateChange(ev=>{if(ev=="SIGNED_OUT"&&uid)location.reload()});
async function sign(rows,raw){const P=[];raw.forEach(r=>{if(r.storage_provider=="supabase"&&r.storage_path)P.push(r.storage_path);if(r.data.tid)P.push(r.data.tid)});const M={};
if(P.length){const{data}=await sb.storage.from("photos").createSignedUrls([...new Set(P)],86400);(data||[]).forEach(x=>{if(x.signedUrl)M[x.path]=x.signedUrl})}
rows.forEach((x,i)=>{const r=raw[i];x.doc.th=r.data.tid?M[r.data.tid]||"":"";x.doc.url=r.storage_provider=="supabase"?(M[r.storage_path]||""):x.doc.th})}
async function load(n){const{data,error}=await sb.from(n).select("*");if(error)throw error;
const rows=data.map(r=>({id:r.id,doc:n=="photos"?{...r.data,sp:r.storage_provider,bs:r.backup_status,bid:r.backup_drive_file_id,gid:r.google_drive_file_id}:r.data}));
if(n=="photos")await sign(rows,data);R[n]=rows;(L[n]||[]).forEach(f=>f(rows));return rows}
const rl=n=>{clearTimeout(TM[n]);TM[n]=setTimeout(()=>load(n).catch(()=>{}),250)};
function watch(n,f,er){(L[n]=L[n]||[]).push(f);if(R[n])f(R[n]);else load(n).catch(er||(()=>{}));
if(!RT.has(n)){RT.add(n);sb.channel("lumen_"+n).on("postgres_changes",{event:"*",schema:"public",table:n},()=>rl(n)).subscribe()}return()=>{}}
async function put(n,id,d){let data=d,cols=null;
if(n=="photos"){const{url,th,sp,bs,bid,gid,...rest}=d;data=rest;const m=META.get(d.aid);
 if(m)cols={storage_provider:m.prov,storage_path:m.prov=="supabase"?d.aid:null,google_drive_file_id:m.prov=="drive"?m.did:null,backup_drive_file_id:m.prov=="supabase"?m.did||null:null,backup_status:m.bs,mime_type:d.type,file_size:d.size,original_file_name:d.name}}
const{data:u,error:e1}=await sb.from(n).update({data}).eq("id",id).eq("user_id",uid).select("id");if(e1)throw e1;
if(!u.length){const row={id,user_id:uid,data,...(cols||{})},{error}=await sb.from(n).insert(row);
 if(error){if(cols&&(cols.google_drive_file_id||cols.backup_drive_file_id)){setOr([...orph().filter(o=>o.id!=id),row]);window.LDrive&&LDrive.orphanWarn()}throw error}
 if(d.aid)META.delete(d.aid)}
rl(n)}
const coll=n=>({doc:id=>({set:d=>put(n,id,d),async delete(){const{error}=await sb.from(n).delete().eq("id",id).eq("user_id",uid);if(error)throw error;rl(n)},
 onSnapshot:(cb,er)=>watch(n,rows=>{const r=rows.find(x=>x.id===id);cb({data:()=>r?r.doc:undefined})},er)}),
 onSnapshot:(cb,er)=>watch(n,rows=>cb({docs:rows.map(r=>({id:r.id,data:()=>r.doc}))}),er)});
const DB={doc:()=>({collection:coll}),collection:coll};
const off=()=>Object.assign(new Error("Koneksi internet terputus. Periksa jaringan lalu coba lagi."),{code:"offline"});
const AS={async upload(f){if(!navigator.onLine)throw off();await ses();
 const mode=f._th?"supabase":(window.LUMEN_MODE||"supabase");
 if(mode=="drive"){if(f.type.startsWith("video"))throw new Error("Video belum didukung untuk mode Google Drive saja. Pilih Supabase atau Supabase + Drive.");
  const did=await LDrive.up(f);META.set(did,{prov:"drive",did,bs:"done"});return{id:did,url:"",sizeBytes:f.size}}
 const key=`${uid}/${f._th?"thumbs/":""}${Date.now()}_${Math.random().toString(36).slice(2,7)}_${f.name.replace(/[^\w.-]/g,"_")}`;
 const{error}=await sb.storage.from("photos").upload(key,f,{contentType:f.type||"application/octet-stream"});if(error)throw navigator.onLine?error:off();
 const{data}=await sb.storage.from("photos").createSignedUrl(key,3600);
 if(!f._th){const m={prov:"supabase",bs:"none"};
  if(mode=="both"){try{m.did=await LDrive.up(f);m.bs="done"}catch(e){m.bs="failed";LDrive.uf++;LDrive.lastErr=e.message}}META.set(key,m)}
 return{id:key,url:data.signedUrl,sizeBytes:f.size}},
 async delete(id){if(id&&id.includes("/")){const{error}=await sb.storage.from("photos").remove([id]);if(error)throw error}}};
const DL={save:async({filename,data})=>{const a=document.createElement("a"),u=URL.createObjectURL(data);a.href=u;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),6e4)}};
window.claude={use:async n=>{const s=await ses();if(n=="user")return{id:async()=>s.user.id,me:async()=>({name:s.user.user_metadata?.name||"",email:s.user.email})};return{db:DB,assets:AS,downloads:DL}[n]||null}};
window.LSB={reload:n=>load(n),orphans:()=>orph().length,
 async retryOrphans(){const a=orph(),keep=[];for(const r of a){const{error}=await sb.from("photos").insert(r);if(error&&error.code!="23505")keep.push(r)}setOr(keep);await load("photos");return a.length-keep.length},
 async logout(){await sb.auth.signOut();location.reload()}};
})();
